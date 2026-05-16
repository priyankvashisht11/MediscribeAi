import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const isNative = Capacitor.isNativePlatform()

export const storage = {
  async get(key) {
    if (isNative) {
      const { value } = await Preferences.get({ key })
      return value
    }
    return localStorage.getItem(key)
  },

  async set(key, value) {
    if (isNative) {
      await Preferences.set({ key, value: String(value) })
    } else {
      localStorage.setItem(key, value)
    }
  },

  async remove(key) {
    if (isNative) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  },
}

// Token-specific helpers (most common usage)
export const TOKEN_KEY = 'mediscribe_token'
export const getToken = () => storage.get(TOKEN_KEY)
export const setToken = (token) => storage.set(TOKEN_KEY, token)
export const removeToken = () => storage.remove(TOKEN_KEY)
