import { useEffect, useState } from 'react'
import { hasRole } from '../../core/utils'

export function usePermissions(world) {
  const [perms, setPerms] = useState(() => {
    const isAdmin = hasRole(world.entities.player?.data.roles, 'admin')
    const isBuilder = isAdmin || world.settings.public
    return { isAdmin, isBuilder }
  })

  useEffect(() => {
    function update() {
      const isAdmin = hasRole(world.entities.player?.data.roles, 'admin')
      const isBuilder = isAdmin || world.settings.public
      setPerms({ isAdmin, isBuilder })
    }

    // Listen for both settings changes and player changes
    world.settings.on('change', update)
    world.on('player', update)

    return () => {
      world.settings.off('change', update)
      world.off('player', update)
    }
  }, [])

  return perms
}
