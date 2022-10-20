import React, { useState } from 'react'
import {  User } from '../types'

export default function useUser () : [ User | null, (user: User | null) => void ] {
  const lsUserString = localStorage.getItem('user')
  const lsUser = typeof lsUserString === 'string' ? JSON.parse(lsUserString) : null

  const [ user, setUser ] = useState<User | null>(lsUser)
  const setUserOuter = (user: User | null) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
    } else {
      localStorage.removeItem('user')
      setUser(null)
    }
  }
  return [ user, setUserOuter ]
}
