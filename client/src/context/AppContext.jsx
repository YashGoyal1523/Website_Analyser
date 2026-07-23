import { createContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'

export const AppContext = createContext()

export const LIGHTHOUSE_AUDIT_SECONDS = 7
export const PAGE_LOAD_ESTIMATE_SECONDS = 8

// Registered at module load — guaranteed to exist before any request fires,
// unlike an interceptor added inside a component effect (axios snapshots the
// interceptor chain when a request is *issued*, so a component-level effect
// can lose the race against a child component's own first request on mount).
// The actual session-clearing logic lives in the component via this listener
// set, since it needs React state setters and the router's navigate().
const sessionExpiredListeners = new Set()
axios.interceptors.response.use(
    (res) => res,
    (error) => {
        const isAuthRoute = error.config?.url?.includes('/api/auth/')
        if (error.response?.status === 401 && !isAuthRoute) {
            sessionExpiredListeners.forEach(fn => fn())
        }
        return Promise.reject(error)
    }
)

const AppContextProvider = ({ children }) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    const [analysisData, setAnalysisData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState({ elapsed: 0, total: 0 })
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token') || '')
    const [userAnalyses, setUserAnalyses] = useState([])
    const [showAuth, setShowAuth] = useState(false)
    const [authMode, setAuthMode] = useState('login')
    const navigate = useNavigate()

    useEffect(() => {
        const savedUser = localStorage.getItem('user')
        if (savedUser && token) setUser(JSON.parse(savedUser))
    }, [])

    // A 401 on an authenticated request means the JWT expired or is invalid —
    // localStorage doesn't know that on its own, so this is what clears the
    // stale session and kicks the user back to login instead of leaving the
    // app stuck in a half-logged-in state.
    useEffect(() => {
        const handleSessionExpired = () => {
            setToken('')
            setUser(null)
            setAnalysisData(null)
            setUserAnalyses([])
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            toast.error('Session expired. Please log in again.')
            navigate('/')
        }
        sessionExpiredListeners.add(handleSessionExpired)
        return () => sessionExpiredListeners.delete(handleSessionExpired)
    }, [navigate])

    const openAuth = (mode = 'login') => {
        setAuthMode(mode)
        setShowAuth(true)
    }

    const persistAuth = (token, user) => {
        setToken(token)
        setUser(user)
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
    }

    const register = async (name, email, password) => {
        try {
            const { data } = await axios.post(`${backendUrl}/api/auth/register`, { name, email, password })
            if (data.success) {
                persistAuth(data.token, data.user)
                toast.success('Account created successfully!')
                return true
            }
            toast.error(data.message)
            return false
        } catch (e) {
            toast.error(e.response?.data?.message || 'Registration failed')
            return false
        }
    }

    const login = async (email, password) => {
        try {
            const { data } = await axios.post(`${backendUrl}/api/auth/login`, { email, password })
            if (data.success) {
                persistAuth(data.token, data.user)
                toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`)
                return true
            }
            toast.error(data.message)
            return false
        } catch (e) {
            toast.error(e.response?.data?.message || 'Login failed')
            return false
        }
    }

    const fetchUserAnalyses = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/analyses`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (data.success) setUserAnalyses(data.data)
        } catch (e) {
            console.error('Failed to fetch analyses', e)
        }
    }

    const deleteAnalysis = async (id) => {
        try {
            const { data } = await axios.delete(`${backendUrl}/api/analyses/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (data.success) {
                setUserAnalyses(prev => prev.filter(a => a._id !== id))
                toast.success('Analysis deleted')
                return true
            }
            toast.error(data.message)
            return false
        } catch (e) {
            if (e.response?.status !== 401) toast.error(e.response?.data?.message || 'Failed to delete analysis')
            return false
        }
    }

    const logout = () => {
        setToken('')
        setUser(null)
        setAnalysisData(null)
        setUserAnalyses([])
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        toast.success('Logged out successfully')
    }

    const analyzeWebsite = async (url, sequence = [], totalDuration, mode = 'auto') => {
        const lighthouseEstimate = PAGE_LOAD_ESTIMATE_SECONDS + LIGHTHOUSE_AUDIT_SECONDS
        const puppeteerEstimate = PAGE_LOAD_ESTIMATE_SECONDS + Number(totalDuration || 0)
        const total = Math.max(lighthouseEstimate, puppeteerEstimate)
        setProgress({ elapsed: 0, total })

        const startedAt = Date.now()
        const timer = setInterval(() => {
            setProgress(prev => ({ ...prev, elapsed: (Date.now() - startedAt) / 1000 }))
        }, 100)

        try {
            setLoading(true)
            const { data } = await axios.post(
                `${backendUrl}/api/analyze`,
                { url, sequence, totalDuration, mode },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            if (data.success) {
                setAnalysisData(data.data)
                fetchUserAnalyses()
                if (data.data.warnings?.length) {
                    toast.warn(
                        <div>
                            <p className="font-semibold mb-1">{data.data.warnings.length} step(s) failed during analysis</p>
                            <ul className="text-xs space-y-0.5 list-disc list-inside">
                                {data.data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>,
                        {
                            style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fbbf24' },
                            autoClose: false,
                            closeOnClick: false,
                            closeButton: ({ closeToast }) => (
                                <button onClick={closeToast} style={{ color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>✕</button>
                            )
                        }
                    )
                }
                return true
            }
            toast.error(data.message)
            return false
        } catch (error) {
            if (error.response?.status !== 401) toast.error(error.response?.data?.message || 'Analysis failed. Is the server running?')
            return false
        } finally {
            clearInterval(timer)
            setLoading(false)
        }
    }

    const value = {
        backendUrl,
        analysisData,
        setAnalysisData,
        loading,
        progress,
        analyzeWebsite,
        user,
        token,
        login,
        register,
        logout,
        showAuth,
        setShowAuth,
        authMode,
        openAuth,
        userAnalyses,
        fetchUserAnalyses,
        deleteAnalysis,
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export default AppContextProvider
