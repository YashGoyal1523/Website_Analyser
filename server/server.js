import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import analysisRouter from './routes/analysisRoutes.js'
import authRouter from './routes/authRoutes.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api', analysisRouter)

app.get('/', (req, res) => res.send('WebsiteAnalyser API working'))

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
})
