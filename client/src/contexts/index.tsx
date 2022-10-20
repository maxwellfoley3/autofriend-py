import React from 'react'
import { BotsConfig, User } from '../types'
export const ConfigContext = React.createContext<BotsConfig| null>(null)
export const UserContext = React.createContext<{user: User| null, setUser: (user: User | null) => void}>({user: null, setUser: (a)=>{}})