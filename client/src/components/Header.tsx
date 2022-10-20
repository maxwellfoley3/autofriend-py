import React from 'react'
import { Link } from 'react-router-dom'
import { ConfigContext, UserContext} from '../contexts'
import './Header.scss'
import { User, UserAndSetUser } from '../types'

export default function Header({ path, setUser }:{path: string, setUser: (user: User | null) => void}) {
  const config = React.useContext(ConfigContext)
  if (!config ) {
    return <div>Loading...</div>
  }

  return (
  <div className="Header"> 
    <div className="left-side">
      <img src="images/automilady.jpg" alt="automilady" />
      { 
        Object.keys(config.twitter).map(o => (
          <div key={o} className={`cell ${path === o ? 'highlighted' : ''}`}>
            <Link to={`/${o}`}>{o}</Link>
          </div>
        ))
      }
    </div>
    <div className="right-side">
      <div className="cell">
        <a onClick={()=>setUser(null)}>Log out</a>
      </div>
    </div>
  </div>)
}