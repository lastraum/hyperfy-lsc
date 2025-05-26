import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'
import { Wallet2Icon, WalletIcon, XIcon } from 'lucide-react'

export function Web3AuthModal({ world, onClose }) {
  const [status, setStatus] = useState('idle') // idle, connecting, signing, verifying, success, error
  const [error, setError] = useState(null)

  // Unlock pointer when modal opens
  useEffect(() => {
    const wasLocked = world.controls.pointer.locked
    if (wasLocked) {
      world.controls.unlockPointer()
    }
    return () => {
      // Restore pointer lock state when modal closes
      if (wasLocked) {
        world.controls.lockPointer()
      }
    }
  }, [])

  // Listen for web3Auth response
  useEffect(() => {
    const onWeb3Auth = (response) => {
      console.log('Web3Auth response:', response)
      if (response.success) {
        setStatus('success')
        setTimeout(() => {
          onClose()
          world.controls.lockPointer()
        }, 1500)
      } else {
        setStatus('error')
        setError(response.error)
      }
    }

    world.on('web3Auth', onWeb3Auth)
    return () => world.off('web3Auth', onWeb3Auth)
  }, [world, onClose])

  const connectWallet = async (type = 'metamask') => {
    try {
      setStatus('connecting')
      setError(null)

      // Get the provider
      let provider
      if (type === 'metamask') {
        if (!window.ethereum) {
          throw new Error('MetaMask not found! Please install MetaMask first.')
        }
        provider = window.ethereum
      } else {
        // Add other wallet providers here
        throw new Error('Wallet type not supported yet')
      }

      // Request account access
      console.log('Requesting account access...')
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      const address = accounts[0]
      console.log('Connected to address:', address)

      // Create message to sign
      setStatus('signing')
      const message = `Authenticate Hyperfy World\nAddress: ${address}\nTimestamp: ${Date.now()}`
      console.log('Message to sign:', message)
      
      // Request signature
      console.log('Requesting signature...')
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, address]
      })
      console.log('Got signature:', signature)

      // Verify on server
      setStatus('verifying')
      console.log('Sending auth request to server:', { address, message, signature })
      world.network.send('web3Auth', { address, message, signature })

    } catch (err) {
      console.error('Web3 auth error:', err)
      setStatus('error')
      setError(err.message)
    }
  }

  return (
    <div css={css`
      background: rgba(11, 10, 21, 0.95);
      border: 1px solid #2a2b39;
      border-radius: 12px;
      padding: 24px;
      width: 360px;
      pointer-events: auto;
    `}>
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      `}>
        <h2 css={css`
          font-size: 18px;
          margin: 0;
        `}>Connect Wallet</h2>
        <div 
          onClick={onClose}
          css={css`
            cursor: pointer;
            opacity: 0.7;
            &:hover {
              opacity: 1;
            }
          `}
        >
          <XIcon size={20} />
        </div>
      </div>

      <div css={css`
        display: flex;
        flex-direction: column;
        gap: 12px;
      `}>
        <button 
          onClick={() => connectWallet('metamask')}
          disabled={status !== 'idle' && status !== 'error'}
          css={css`
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            color: white;

            &:hover {
              background: rgba(255, 255, 255, 0.1);
            }

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          `}
        >
          <Wallet2Icon size={24} />
          <span>MetaMask</span>
        </button>

        <button 
          disabled={true}
          css={css`
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            cursor: not-allowed;
            opacity: 0.5;
            color: white;
          `}
        >
          <WalletIcon size={24} />
          <span>More wallets coming soon...</span>
        </button>
      </div>

      <div css={css`
        text-align: center;
        margin-top: 16px;
        min-height: 24px;
        color: ${status === 'error' ? '#ff4d4d' : status === 'success' ? '#4dff4d' : 'white'};
      `}>
        {status === 'connecting' && 'Connecting to wallet...'}
        {status === 'signing' && 'Please sign the message...'}
        {status === 'verifying' && 'Verifying signature...'}
        {status === 'success' && '✓ Successfully authenticated!'}
        {status === 'error' && error}
      </div>
    </div>
  )
} 