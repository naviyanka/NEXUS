import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:5000/api', // To be dynamic based on environment
  withCredentials: true, // Crucial for Microsoft.AspNetCore.Authentication.Negotiate
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (redirect to login)
      window.location.href = '/sign-in'
    }
    return Promise.reject(error)
  }
)
