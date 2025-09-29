import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { PrismaClient, OtpType } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate';
import { Resend } from 'resend'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Extend Hono types for context variables
type Variables = {
  userId: string
}

const app = new Hono<{ Variables: Variables }>()

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

const resend = new Resend(process.env.RESEND_API_KEY)

app.use('/*', cors())

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

function generateToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'session' },
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: '30d' }
  )
}

function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-jwt-secret'
    ) as { userId: string; type: string }
    
    if (decoded.type === 'session') {
      return { userId: decoded.userId }
    }
    return null
  } catch (error) {
    return null
  }
}

async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  
  if (!decoded) {
    return c.json({ error: 'Invalid token' }, 401)
  }
  
  const session = await prisma.session.findFirst({
    where: {
      token,
      isActive: true,
      expiresAt: {
        gt: new Date()
      }
    }
  })
  
  if (!session) {
    return c.json({ error: 'Session expired' }, 401)
  }
  
  c.set('userId', decoded.userId)
  await next()
}

async function sendOTPEmail(email: string, otp: string, type: OtpType): Promise<void> {
  const typeText = type === 'SIGNUP' ? 'signup' : 'signin'
  const subject = type === 'SIGNUP' ? 'Welcome! Verify your account' : 'Sign In Verification'
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">HD App</h1>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
            <h2 style="color: #333; margin-top: 0;">Verification Code</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
              Your verification code for ${typeText} is:
            </p>
            
            <div style="background: #007AFF; color: white; font-size: 32px; font-weight: bold; 
                        padding: 20px; border-radius: 8px; letter-spacing: 4px; margin: 20px 0;">
              ${otp}
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This code will expire in <strong>10 minutes</strong>
            </p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      `
    })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.status}`)
  }
}

async function cleanupExpiredOtps(): Promise<void> {
  try {
    await prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
  } catch (error) {
    // Silent fail for cleanup
  }
}

app.post('/api/signup', async (c) => {
  try {
    const { name, email, dateOfBirth } = await c.req.json()
    
    if (!name || !email || !dateOfBirth) {
      return c.json({ error: 'Name, email, and date of birth are required' }, 400)
    }
    
    try {
      await cleanupExpiredOtps()
      
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      })
      
      if (existingUser) {
        return c.json({ error: 'User already exists' }, 409)
      }
      
      await prisma.otp.deleteMany({
        where: { 
          email: email.toLowerCase().trim(), 
          type: OtpType.SIGNUP 
        }
      })
      
      const code = generateOTP()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      
      await prisma.otp.create({
        data: {
          code,
          email: email.toLowerCase().trim(),
          type: OtpType.SIGNUP,
          expiresAt,
          signupData: {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            dateOfBirth
          }
        }
      })
      
      await sendOTPEmail(email.toLowerCase().trim(), code, OtpType.SIGNUP)
      
      return c.json({ 
        message: 'OTP sent to your email',
        email: email.toLowerCase().trim()
      })
      
    } catch (error: any) {
      if (error.code === 'P2002') {
        return c.json({ error: 'Email already exists' }, 409)
      }
      
      return c.json({ 
        error: 'Signup failed. Please try again.'
      }, 500)
    }
  } catch (error: any) {
    return c.json({ error: 'Invalid request data' }, 400)
  }
})

app.post('/api/signup/verify', async (c) => {
  try {
    const { email, otp } = await c.req.json()
    
    if (!email || !otp) {
      return c.json({ error: 'Email and OTP are required' }, 400)
    }
    
    try {
      const { email, otp } = await c.req.json()
      
      const otpRecord = await prisma.otp.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          code: otp.trim(),
          type: OtpType.SIGNUP,
          verified: false,
          expiresAt: {
            gt: new Date()
          }
        }
      })
      
      if (!otpRecord) {
        return c.json({ error: 'Invalid or expired OTP' }, 400)
      }
      
      if (otpRecord.attempts >= 5) {
        return c.json({ error: 'Too many attempts. Please request a new OTP.' }, 400)
      }
      
      const signupData = otpRecord.signupData as any
      
      if (!signupData) {
        return c.json({ error: 'Invalid signup data' }, 400)
      }
      
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: signupData.name,
            email: signupData.email,
            dateOfBirth: new Date(signupData.dateOfBirth),
            verified: true
          }
        })
        
        await tx.otp.update({
          where: { id: otpRecord.id },
          data: { 
            verified: true,
            userId: user.id
          }
        })
        
        return user
      })
      
      const token = generateToken(result.id)
      
      await prisma.session.create({
        data: {
          userId: result.id,
          token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          userAgent: c.req.header('user-agent') || null,
          ipAddress: c.req.header('cf-connecting-ip') || 
                    c.req.header('x-forwarded-for') || 
                    'unknown'
        }
      })
      
      return c.json({ 
        message: 'Account created successfully',
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          dateOfBirth: result.dateOfBirth
        },
        token
      })
    } catch (error: any) {
      return c.json({ error: 'Verification failed' }, 500)
    }
  } catch (error: any) {
    return c.json({ error: 'Invalid request data' }, 400)
  }
})

app.post('/api/signin', async (c) => {
  try {
    const { email } = await c.req.json()
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }
    
    try {
      const { email } = await c.req.json()
      
      await cleanupExpiredOtps()
      
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      })
      
      if (!user) {
        return c.json({ error: 'User not found' }, 404)
      }
      
      if (!user.verified) {
        return c.json({ error: 'Please complete signup verification first' }, 400)
      }
      
      if (!user.isActive) {
        return c.json({ error: 'Account is deactivated' }, 403)
      }
      
      await prisma.otp.deleteMany({
        where: { 
          email: email.toLowerCase().trim(), 
          type: OtpType.SIGNIN 
        }
      })
      
      const code = generateOTP()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      
      await prisma.otp.create({
        data: {
          code,
          email: email.toLowerCase().trim(),
          type: OtpType.SIGNIN,
          expiresAt,
          userId: user.id
        }
      })
      
      await sendOTPEmail(email.toLowerCase().trim(), code, OtpType.SIGNIN)
      
      return c.json({ 
        message: 'OTP sent to your email',
        email: email.toLowerCase().trim()
      })
      
    } catch (error: any) {
      return c.json({ error: 'Failed to send OTP' }, 500)
    }
  } catch (error: any) {
    return c.json({ error: 'Invalid request data' }, 400)
  }
})

app.post('/api/signin/verify', async (c) => {
  try {
    const { email, otp, keepLoggedIn = false } = await c.req.json()
    
    if (!email || !otp) {
      return c.json({ error: 'Email and OTP are required' }, 400)
    }
    
    try {
      const { email, otp, keepLoggedIn = false } = await c.req.json()
      
      const otpRecord = await prisma.otp.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          code: otp.trim(),
          type: OtpType.SIGNIN,
          verified: false,
          expiresAt: {
            gt: new Date()
          }
        },
        include: { user: true }
      })
      
      if (!otpRecord || !otpRecord.user) {
        if (otpRecord) {
          await prisma.otp.update({
            where: { id: otpRecord.id },
            data: { attempts: { increment: 1 } }
          })
        }
        return c.json({ error: 'Invalid or expired OTP' }, 400)
      }
      
      if (otpRecord.attempts >= 5) {
        return c.json({ error: 'Too many attempts. Please request a new OTP.' }, 400)
      }
      
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { verified: true }
      })
      
      const token = generateToken(otpRecord.user.id)
      const expiresAt = keepLoggedIn 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000)
      
      await prisma.session.create({
        data: {
          userId: otpRecord.user.id,
          token,
          expiresAt,
          userAgent: c.req.header('user-agent') || null,
          ipAddress: c.req.header('cf-connecting-ip') || 
                    c.req.header('x-forwarded-for') || 
                    'unknown'
        }
      })
      
      return c.json({ 
        message: 'Signed in successfully',
        user: {
          id: otpRecord.user.id,
          name: otpRecord.user.name,
          email: otpRecord.user.email,
          dateOfBirth: otpRecord.user.dateOfBirth
        },
        token
      })
    } catch (error: any) {
      return c.json({ error: 'Signin failed' }, 500)
    }
  } catch (error: any) {
    return c.json({ error: 'Invalid request data' }, 400)
  }
})

app.post('/api/logout', async (c) => {
  try {
    const { token } = await c.req.json()
    
    if (!token) {
      return c.json({ error: 'Token is required' }, 400)
    }
    
    try {
      const { token } = await c.req.json()
      
      await prisma.session.updateMany({
        where: { token },
        data: { isActive: false }
      })
      
      return c.json({ message: 'Logged out successfully' })
    } catch (error: any) {
      return c.json({ error: 'Logout failed' }, 500)
    }
  } catch (error: any) {
    return c.json({ error: 'Invalid request data' }, 400)
  }
})

// Get all notes
app.get('/api/notes', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
    
    return c.json({ notes })
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch notes' }, 500)
  }
})

// Create note
app.post('/api/notes', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const { title, content = '' } = body
    
    if (!title || !title.trim()) {
      return c.json({ error: 'Title is required' }, 400)
    }
    
    const note = await prisma.note.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        userId
      }
    })
    
    return c.json({ 
      message: 'Note created successfully',
      note 
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to create note' }, 500)
  }
})

// Update note
app.put('/api/notes/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const noteId = c.req.param('id')
    const body = await c.req.json()
    const { title, content } = body
    
    if (!title && content === undefined) {
      return c.json({ error: 'Title or content is required' }, 400)
    }
    
    const existingNote = await prisma.note.findFirst({
      where: { id: noteId, userId }
    })
    
    if (!existingNote) {
      return c.json({ error: 'Note not found' }, 404)
    }
    
    const note = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(title && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() })
      }
    })
    
    return c.json({ 
      message: 'Note updated successfully',
      note 
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to update note' }, 500)
  }
})

// Delete note
app.delete('/api/notes/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const noteId = c.req.param('id')
    
    const existingNote = await prisma.note.findFirst({
      where: { id: noteId, userId }
    })
    
    if (!existingNote) {
      return c.json({ error: 'Note not found' }, 404)
    }
    
    await prisma.note.delete({
      where: { id: noteId }
    })
    
    return c.json({ message: 'Note deleted successfully' })
  } catch (error: any) {
    return c.json({ error: 'Failed to delete note' }, 500)
  }
})

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  })
})

// Add this route to your backend after the signin route

app.post('/api/signin/resend', async (c) => {
  try {
    const { email } = await c.req.json()
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }
    
    try {
      await cleanupExpiredOtps()
      
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      })
      
      if (!user) {
        return c.json({ error: 'User not found' }, 404)
      }
      
      if (!user.verified) {
        return c.json({ error: 'Please complete signup verification first' }, 400)
      }
      
      if (!user.isActive) {
        return c.json({ error: 'Account is deactivated' }, 403)
      }
      
      // Delete any existing SIGNIN OTPs for this email
      await prisma.otp.deleteMany({
        where: { 
          email: email.toLowerCase().trim(), 
          type: OtpType.SIGNIN 
        }
      })
      
      const code = generateOTP()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      
      await prisma.otp.create({
        data: {
          code,
          email: email.toLowerCase().trim(),
          type: OtpType.SIGNIN,
          expiresAt,
          userId: user.id
        }
      })
      
      await sendOTPEmail(email.toLowerCase().trim(), code, OtpType.SIGNIN)
      
      return c.json({ 
        message: 'New OTP sent to your email',
        email: email.toLowerCase().trim()
      })
      
    } catch (error: any) {
      return c.json({ error: 'Failed to resend OTP' }, 500)
    }
  } catch (error: any) {
    return c.json({ error: 'Invalid request data' }, 400)
  }
})



export default app