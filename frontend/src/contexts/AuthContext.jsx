import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        const response = await authApi.getCurrentUser()
        if (response.success) {
          setUser(response.user)
        } else {
          localStorage.removeItem('authToken')
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('authToken')
    } finally {
      setLoading(false)
    }
  }

  const login = async () => {
    try {
      // Redirect to backend OAuth endpoint
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/login`
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setUser(null)
      localStorage.removeItem('authToken')
    }
  }

  const handleAuthCallback = async (token) => {
    try {
      localStorage.setItem('authToken', token)
      const response = await authApi.getCurrentUser()
      if (response.success) {
        setUser(response.user)
        return true
      }
    } catch (error) {
      console.error('Auth callback failed:', error)
    }
    return false
  }

  const value = {
    user,
    loading,
    login,
    logout,
    handleAuthCallback
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 