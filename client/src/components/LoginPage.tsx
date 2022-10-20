import React, {KeyboardEvent, useState} from 'react'
import { User } from '../types'
import { login } from '../api'
import './LoginPage.scss'

export default function LoginPage ({setUser}: {setUser: (user: User) => void}) {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loginResponseMessage, setLoginResponseMessage] = useState<string>('')
  const [isFormInProcess, setIsFormInProcess] = useState<boolean>(false)

  const submitForm = () => {
    setLoginResponseMessage('Loading...')
    setIsFormInProcess(true)
    login(username, password)
    .then((res)=>{
      setIsFormInProcess(false)
      setUser(res.data)
    })
    .catch((err)=>{  
      if (err.response.status == 401) {
        setLoginResponseMessage('Invalid credentials')
      } else {
        setLoginResponseMessage('An error occured on the server when attempting to log in.')
      }
      setIsFormInProcess(false)      
      console.error(err)
    })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { 
      submitForm()
    }
  }

  return (
    <div className={'LoginPage'}>
      <div className={'header'}>
        <h1>automilady</h1>
        <h5>by HarmlessAi 🐝</h5>
      </div>
      <form onKeyDown={onKeyDown}>
        <li>
          <label>Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}/>
        </li>
        <li>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
        </li>
      </form>
      <li>{loginResponseMessage}</li>
      <li>
        <button disabled={isFormInProcess} onClick={submitForm}>Login</button>
      </li>
    </div>
  )
}