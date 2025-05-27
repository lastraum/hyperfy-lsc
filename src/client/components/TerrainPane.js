import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import { MountainIcon, LayersIcon, PaintbrushIcon, Undo2Icon } from 'lucide-react'
import { usePane } from './usePane'
import { cls } from './cls'
import { FieldRange, FieldSwitch, FieldNumber } from './Fields'
import { createNoise2D, createNoise3D } from 'simplex-noise'
import * as THREE from 'three'
import { Node } from '../../core/nodes/Node'

// Create a TerrainNode class that extends Node
class TerrainNode extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'terrain'
    
    // Store terrain properties
    this.size = data.size || 256
    this.height = data.height || 50
    this.roughness = data.roughness || 0.5
    this.seed = data.seed || Math.random() * 1000000

    // Initialize transform
    this.position = new THREE.Vector3()
    this.rotation = new THREE.Euler()
    this.matrix = new THREE.Matrix4()
    this.matrixWorld = new THREE.Matrix4()

    this._geometry = null
    this._material = null
    this.mesh = null
    this.needsRebuild = true
  }

  updateMatrix() {
    this.matrix.makeRotationFromEuler(this.rotation)
    this.matrix.setPosition(this.position)
    return this.matrix
  }

  mount() {
    console.log('TerrainNode mounting')
    if (!this.needsRebuild) return

    // Create geometry
    const segments = 128
    this._geometry = new THREE.PlaneGeometry(this.size, this.size, segments, segments)
    
    // Generate heightmap
    const vertices = this._geometry.attributes.position.array
    const noise2D = createNoise2D(() => this.seed / 1000000)
    const noise3D = createNoise3D(() => this.seed / 1000000)
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i]
      const z = vertices[i + 2]
      
      let elevation = 0
      
      // Large scale features
      let amplitude = 1
      let frequency = this.roughness * 0.005
      elevation += noise2D(x * frequency, z * frequency) * amplitude
      
      // Medium scale features
      amplitude = 0.5
      frequency = this.roughness * 0.02
      elevation += noise2D(x * frequency, z * frequency) * amplitude
      
      // Small scale details
      amplitude = 0.25
      frequency = this.roughness * 0.04
      elevation += noise3D(x * frequency, z * frequency, this.seed * 0.01) * amplitude
      
      // Ridge formation
      const ridgeNoise = Math.abs(noise2D(x * this.roughness * 0.01, z * this.roughness * 0.01))
      elevation += Math.pow(ridgeNoise, 3) * this.height * 0.5
      
      vertices[i + 1] = elevation * this.height
    }

    this._geometry.computeVertexNormals()

    // Create material
    this._material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1
    })

    // Create mesh
    this.mesh = new THREE.Mesh(this._geometry, this._material)
    this.mesh.name = this.name
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.matrixAutoUpdate = false

    // Update transform and add to scene
    this.matrixWorld.copy(this.updateMatrix())
    this.mesh.matrix.copy(this.matrixWorld)
    this.ctx.world.stage.scene.add(this.mesh)
    console.log('Added mesh to scene:', this.mesh)
    console.log('Mesh matrix:', this.mesh.matrix.elements)
    console.log('Node matrix:', this.matrixWorld.elements)

    // Add to octree
    this.sItem = {
      matrix: this.matrixWorld,
      geometry: this._geometry,
      material: this._material,
      getEntity: () => this.ctx.entity,
      node: this,
    }
    this.ctx.world.stage.octree.insert(this.sItem)
    console.log('Added to octree:', this.sItem)

    this.needsRebuild = false
  }

  unmount() {
    console.log('TerrainNode unmounting')
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      if (this.sItem) {
        this.ctx.world.stage.octree.remove(this.sItem)
        this.sItem = null
      }
      this.mesh.geometry.dispose()
      this.mesh.material.dispose()
      this.mesh = null
    }
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    
    if (didMove && this.mesh) {
      this.mesh.matrix.copy(this.matrixWorld)
      if (this.sItem) {
        this.ctx.world.stage.octree.move(this.sItem)
      }
    }
  }
}

// Register the TerrainNode with the node system
if (!window.Nodes) window.Nodes = {}
window.Nodes.terrain = TerrainNode

export function TerrainPane({ world, hidden }) {
  const paneRef = useRef()
  const headRef = useRef()
  usePane('terrain', paneRef, headRef)
  
  const [tab, setTab] = useState('generate')
  const [size, setSize] = useState(256)
  const [height, setHeight] = useState(50)
  const [roughness, setRoughness] = useState(0.5)
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000))
  const [terrainNode, setTerrainNode] = useState(null)
  const [hideGrass, setHideGrass] = useState(false)
  const grassRef = useRef(null)

  // Effect to find and store grass reference
  useEffect(() => {
    if (!world?.stage?.octree) return;

    const findGrass = () => {
      const processNode = (node) => {
        for (const item of node.items) {
          if (item.material?.map?.name?.includes('grass')) {
            return item;
          }
        }
        for (const child of node.children) {
          const found = processNode(child);
          if (found) return found;
        }
        return null;
      };

      const grass = processNode(world.stage.octree.root);
      if (grass) {
        grassRef.current = grass;
        // Set initial visibility based on state
        if (grass.node) {
          grass.node.visible = !hideGrass;
        }
      }
    };

    findGrass();
  }, [world?.stage?.octree]);

  // Function to toggle grass visibility
  const toggleGrass = (value) => {
    setHideGrass(value);
    if (grassRef.current?.node) {
      grassRef.current.node.visible = !value;
      console.log('Toggled grass visibility:', !value);
    }
  };

  const hideDefaultGrass = () => {
    // Find grass in scene children
    const grassMesh = world.stage.scene.children.find(obj => 
      obj.type === 'Mesh' && 
      obj.material?.map?.name?.includes('grass')
    );
    
    if (grassMesh) {
      grassMesh.visible = false;
      console.log('Hid default grass plane');
    }
  };

  const generateTerrain = () => {
    console.log('Starting terrain generation with params:', { size, height, roughness, seed })
    
    // Hide default grass first
    hideDefaultGrass()
    
    // Remove existing terrain if any
    if (terrainNode) {
      console.log('Removing existing terrain')
      terrainNode.deactivate()
    }

    try {
      // Create terrain node
      const node = new TerrainNode({
        size,
        height,
        roughness,
        seed,
        active: true
      })

      // Set up context and activate
      node.ctx = { 
        world, 
        entity: { 
          id: `terrain_${Date.now()}`,
          type: 'terrain'
        } 
      }

      // Set position and rotation
      node.position.set(0, 0.1, 0)
      node.rotation.set(-Math.PI/2, 0, 0)
      
      console.log('Created terrain node:', {
        position: node.position.toArray(),
        rotation: node.rotation.toArray(),
        matrix: node.updateMatrix().elements
      })

      node.activate()
      console.log('Activated terrain node')

      // Store node for cleanup
      setTerrainNode(node)

      return () => {
        if (terrainNode) {
          terrainNode.deactivate()
        }
      }
    } catch (error) {
      console.error('Failed to create terrain:', error)
    }
  }

  return (
    <div
      ref={paneRef}
      className='terrain-pane'
      css={css`
        position: absolute;
        top: 20px;
        left: 60px;
        width: 320px;
        background: rgba(11, 10, 21, 0.85);
        border: 0.0625rem solid #2a2b39;
        backdrop-filter: blur(5px);
        border-radius: 1rem;
        pointer-events: auto;
        display: flex;
        flex-direction: column;

        .terrain-head {
          height: 3.125rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 1rem;
        }

        .terrain-title {
          font-weight: 500;
          font-size: 1rem;
          line-height: 1;
          flex: 1;
        }

        .terrain-tabs {
          display: flex;
          padding: 0.5rem;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .terrain-tab {
          flex: 1;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: rgba(255, 255, 255, 0.5);
          border-radius: 0.5rem;
          
          &:hover {
            cursor: pointer;
            background: rgba(255, 255, 255, 0.05);
          }

          &.active {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }

          svg {
            width: 1rem;
            height: 1rem;
          }
        }

        .terrain-content {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
        }

        .terrain-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .terrain-action {
          flex: 1;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          
          &:hover {
            cursor: pointer;
            background: rgba(255, 255, 255, 0.15);
          }

          &.primary {
            background: #2563eb;
            &:hover {
              background: #1d4ed8;
            }
          }
        }

        .terrain-info {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.4;
        }
      `}
    >
      <div className='terrain-head' ref={headRef}>
        <div className='terrain-title'>Terrain Editor</div>
      </div>

      <div className='terrain-tabs'>
        <div 
          className={cls('terrain-tab', { active: tab === 'generate' })}
          onClick={() => setTab('generate')}
        >
          <MountainIcon />
          <span>Generate</span>
        </div>
        <div 
          className={cls('terrain-tab', { active: tab === 'layers' })}
          onClick={() => setTab('layers')}
        >
          <LayersIcon />
          <span>Layers</span>
        </div>
      </div>

      <div className='terrain-content noscrollbar'>
        {tab === 'generate' && (
          <>
            <div className='terrain-info'>
              Changes will be applied directly to the world. Use the controls below to adjust the terrain parameters.
            </div>
            
            <FieldRange
              label='Size'
              hint='Size of the terrain in meters'
              min={64}
              max={1024}
              step={64}
              value={size}
              onChange={setSize}
            />
            <FieldRange
              label='Height'
              hint='Maximum height of the terrain'
              min={0}
              max={100}
              step={1}
              value={height}
              onChange={setHeight}
            />
            <FieldRange
              label='Roughness'
              hint='Roughness of the terrain'
              min={0}
              max={1}
              step={0.1}
              value={roughness}
              onChange={setRoughness}
            />
            <FieldNumber
              label='Seed'
              hint='Random seed for terrain generation'
              value={seed}
              onChange={setSeed}
            />

            <div className='terrain-actions'>
              <div className='terrain-action' onClick={() => setSeed(Math.floor(Math.random() * 1000000))}>
                <Undo2Icon size='1rem' style={{ marginRight: '0.5rem' }} />
                Randomize
              </div>
              <div className='terrain-action primary' onClick={generateTerrain}>
                Generate
              </div>
            </div>
          </>
        )}

        {tab === 'layers' && (
          <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '2rem' }}>
            Layer editing coming soon
          </div>
        )}
      </div>
    </div>
  )
} 