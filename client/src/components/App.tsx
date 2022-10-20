import './App.scss'
import React, { useState, useEffect, useReducer } from 'react'
import { ConfigContext, UserContext } from '../contexts'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom"
import 'draft-js/dist/Draft.css'
import { BotsConfig, User } from '../types'
import { getConfig } from '../api'
import Page from './Page'
import BotPlayground from './BotPlayground'
import Home from './Home'
import useUser from '../hooks/useUser'

function App() {
  const [ config, setConfig ] = useState<BotsConfig | null>(null)
  const [ user, setUser ] = useUser()
  
  useEffect(() => {
    getConfig().then(( data ) => {
      setConfig(data)
    })
  },[])

  if (!config) {
    return <div>Loading...</div>
  }

  const elements = Object.keys(config.twitter)
  .map((o) => {
    return {
      path:o, element:<Page path={o}><BotPlayground botName={o} bot={config.twitter[o]} /></Page>
    }
  })

  
  const router = createBrowserRouter([...elements, { path: '/', element: <Page path={'/'}><Home/></Page> }])

  return (
    <div className="App">
      <UserContext.Provider value={{ user, setUser}}>
        <ConfigContext.Provider value={config}>
          <RouterProvider router={router} />
        </ConfigContext.Provider>
      </UserContext.Provider>
    </div>
  );
}

export default App;
