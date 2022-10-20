import React, { useContext } from 'react'
import { UserContext } from '../contexts'
import Bouncer from './Bouncer'
import LoginPage from './LoginPage'
import Header from './Header'
 
export default function Page({path, children} : {path: string, children: JSX.Element | JSX.Element[]}) {
  const { user, setUser } = useContext(UserContext)
  if (!user) { 
    return <Bouncer><LoginPage setUser={setUser}/></Bouncer>
  }
  return <React.Fragment>
    <Header path={path} setUser={setUser}/>
    {children}
  </React.Fragment>
}