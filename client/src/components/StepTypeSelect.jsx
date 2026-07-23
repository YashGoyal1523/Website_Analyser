import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const StepTypeSelect = ({ value, onChange, disabled, options, dotColors }) => {
    const [open, setOpen] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
    const triggerRef = useRef(null)
    const menuRef = useRef(null)

    const close = () => setOpen(false)

    const openMenu = () => {
        if (disabled) return
        const rect = triggerRef.current.getBoundingClientRect()
        setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
        setOpen(true)
    }

    useEffect(() => {
        if (!open) return

        const handleClick = (e) => {
            if (triggerRef.current?.contains(e.target)) return
            if (menuRef.current?.contains(e.target)) return
            close()
        }
        const handleKey = (e) => { if (e.key === 'Escape') close() }
        const handleScroll = () => close()

        document.addEventListener('mousedown', handleClick)
        document.addEventListener('keydown', handleKey)
        window.addEventListener('scroll', handleScroll, true)
        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('keydown', handleKey)
            window.removeEventListener('scroll', handleScroll, true)
        }
    }, [open])

    return (
        <div className="shrink-0">
            <button
                type="button"
                ref={triggerRef}
                disabled={disabled}
                onClick={() => (open ? close() : openMenu())}
                className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
            >
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[value]}`} />
                {options[value]}
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: coords.width }}
                    className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
                >
                    {Object.entries(options).map(([val, label]) => (
                        <button
                            key={val}
                            type="button"
                            onClick={() => { onChange(val); close() }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[val]}`} />
                            <span className="flex-1">{label}</span>
                            {val === value && (
                                <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}

export default StepTypeSelect
