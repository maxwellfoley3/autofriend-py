import React, { useState, useEffect, useRef } from 'react'

type direction = 'up-left' | 'up-right' | 'down-left' | 'down-right'
export default function Bouncer({children}: {children: React.ReactNode}) {
	const [ x, setX ] = useState(100)
	const [ y, setY ] = useState(100)
	const [ windowHeight, setWindowHeight ] = useState(window.innerHeight)
	const [	windowWidth, setWindowWidth ] = useState(window.innerWidth)
	const [ direction, setDirection ] = useState('down-right' as direction)
	
	const [ isFocused, setIsFocused ] = useState(false)

	const childContainer = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const childWidth = childContainer.current?.clientWidth
		const childHeight = childContainer.current?.clientHeight
		const UPDATE_INTERVAL = 100
		if (!isFocused) {
			if ( direction === 'down-right' ) {
				if ( x + childWidth! >= windowWidth ) {
					setTimeout(() => setDirection('down-left'), UPDATE_INTERVAL)
				} else if (y + childHeight! >= windowHeight) {
					setTimeout(() => setDirection('up-right'), UPDATE_INTERVAL)
				} else {
					setTimeout(() => { setX(x+5); setY(y+5) }, UPDATE_INTERVAL)
				}
			}	else if ( direction === 'down-left' ) {
				if ( x <= 0 ) {
					setTimeout(() => setDirection('down-right'), UPDATE_INTERVAL)
				} else if ( y + childHeight! >= windowHeight ) {
					setTimeout(() => setDirection('up-left'), UPDATE_INTERVAL)
				} else {
					setTimeout(() => { setX(x-5); setY(y+5) }, UPDATE_INTERVAL)
				}
			}	else if ( direction === 'up-left' ) {
				if ( y <= 0 ) {
					setTimeout(() => setDirection('down-left'), UPDATE_INTERVAL)
				} else if ( x <= 0 ) {
					setTimeout(() => setDirection('up-right'), UPDATE_INTERVAL)
				} else {
					setTimeout(() => { setX(x-5); setY(y-5) }, UPDATE_INTERVAL)
				}
			}	else if ( direction === 'up-right' ) {
				if ( x + childWidth! >= windowWidth ) {
					setTimeout(() => setDirection('up-left'), UPDATE_INTERVAL)
				} else if	( y <= 0 ) {
					setTimeout(() => setDirection('down-right'), UPDATE_INTERVAL)
				} else {
					setTimeout(() => { setX(x+5); setY(y-5) }, UPDATE_INTERVAL)
				}	
			}
		}
	}, [x, y, direction, isFocused])


	useEffect(() => {
		const onResize = () => {
			setWindowHeight(window.innerHeight)
			setWindowWidth(window.innerWidth)
		}
		window.addEventListener('resize', onResize)
			return () => window.removeEventListener('resize', onResize)
	}, [])


	return <div 
		ref={childContainer} 
		onMouseOver={() => setIsFocused(true)}
		onMouseLeave={() => setIsFocused(false)}
		style={{top:y, left:x, position:'absolute'}}>
			{ children }
		</div>
}