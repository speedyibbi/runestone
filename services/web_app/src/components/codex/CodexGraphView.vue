<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import { useSessionStore } from '@/stores/session'
import Loader from '@/components/base/Loader.vue'
import Dropdown from '@/components/form/Dropdown.vue'
import type { GraphNode, GraphEdge, GraphQueryOptions } from '@/interfaces/graph'

interface Props {
  openRune?: (runeId: string) => Promise<void>
}

const props = defineProps<Props>()

const isGraphEnabled = __APP_CONFIG__.global.featureFlags.graph

// Extend GraphNode with d3 simulation properties
interface GraphNodeWithSimulation extends GraphNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

const sessionStore = useSessionStore()

const svgRef = ref<SVGSVGElement>()
const containerRef = ref<HTMLDivElement>()
const titleSearchInputRef = ref<HTMLInputElement>()
const isLoading = ref(true)
const error = ref<string | null>(null)

let simulation: d3.Simulation<GraphNodeWithSimulation, undefined> | null = null
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let nodes: GraphNodeWithSimulation[] = []
let edges: GraphEdge[] = []
// After d3-force processes edges, source/target become node objects
type ProcessedEdge = GraphEdge & {
  source: GraphNodeWithSimulation
  target: GraphNodeWithSimulation
}
let nodeElements: d3.Selection<
  SVGCircleElement,
  GraphNodeWithSimulation,
  SVGGElement,
  unknown
> | null = null
let edgeElements: d3.Selection<SVGLineElement, ProcessedEdge, SVGGElement, unknown> | null = null
let labelElements: d3.Selection<
  SVGTextElement,
  GraphNodeWithSimulation,
  SVGGElement,
  unknown
> | null = null
let zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null

// Physics parameters (Obsidian-style)
const DAMPING = 0.92 // High damping for fast settling
const MAX_VELOCITY = 50 // Clamp velocity to prevent explosions
const MIN_VELOCITY_THRESHOLD = 0.1 // Snap to zero below this
const REPULSION_STRENGTH = 2000
const SPRING_STRENGTH = 0.1
const SPRING_LENGTH = 100
const CENTERING_STRENGTH = 0.05

// Interaction state
const selectedNode = ref<GraphNode | null>(null)
const hoveredNode = ref<GraphNode | null>(null)
let draggedNode: GraphNode | null = null
let resizeHandler: (() => void) | null = null

// Filter state
const selectedHashtags = ref<string[]>([])
const availableHashtags = ref<Map<string, number>>(new Map())
const titlePattern = ref('')
let titlePatternTimeout: ReturnType<typeof setTimeout> | null = null

// Neighborhood view state
const centerNodeUuid = ref<string | null>(null)
const neighborhoodDepth = ref<number>(2)

async function loadGraph() {
  if (!isGraphEnabled) {
    error.value = 'Graph feature is disabled'
    isLoading.value = false
    return
  }

  if (!sessionStore.hasOpenCodex) {
    error.value = 'No codex is currently open'
    isLoading.value = false
    return
  }

  try {
    isLoading.value = true
    error.value = null

    // Build query options with hashtag filters and title pattern
    // Normalize selectedHashtags to always be an array (handle null from dropdown)
    const hashtags = Array.isArray(selectedHashtags.value)
      ? selectedHashtags.value
      : selectedHashtags.value === null
        ? []
        : [selectedHashtags.value]

    const hasFilters = hashtags.length > 0 || titlePattern.value.trim().length > 0

    const queryOptions: GraphQueryOptions = {
      ...(hasFilters
        ? {
            filters: {
              hashtags: hashtags.length > 0 ? hashtags : undefined,
              titlePattern: titlePattern.value.trim() || undefined,
            },
          }
        : {}),
      ...(centerNodeUuid.value
        ? {
            centerUuid: centerNodeUuid.value,
            depth: neighborhoodDepth.value,
          }
        : {}),
    }

    const graphData = await sessionStore.getGraph(queryOptions)
    nodes = graphData.nodes
    edges = graphData.edges
    availableHashtags.value = graphData.hashtags

    // Filter edges to only include those where both source and target nodes exist
    // This prevents d3-force errors when filtering in neighborhood view
    const nodeUuids = new Set(nodes.map((n) => n.uuid))
    edges = edges.filter((edge) => nodeUuids.has(edge.source) && nodeUuids.has(edge.target))

    if (nodes.length === 0) {
      // Clear the existing graph visualization
      cleanup()
      error.value = 'No nodes found'
      isLoading.value = false
      return
    }

    // Clear any previous error if we have nodes
    error.value = null

    await nextTick()
    // Wait for refs to be available
    let retries = 0
    while ((!svgRef.value || !containerRef.value) && retries < 10) {
      await nextTick()
      retries++
    }

    if (!svgRef.value || !containerRef.value) {
      error.value = 'Failed to initialize graph view'
      isLoading.value = false
      return
    }

    initializeGraph()
  } catch (err) {
    console.error('Error loading graph:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load graph'
    isLoading.value = false
  }
}

function initializeGraph() {
  try {
    if (!svgRef.value || !containerRef.value) {
      isLoading.value = false
      error.value = 'Graph view elements not available'
      return
    }

    const container = containerRef.value
    const width = container.clientWidth
    const height = container.clientHeight

    if (width === 0 || height === 0) {
      // Container might not have dimensions yet, retry after a short delay
      setTimeout(() => {
        if (svgRef.value && containerRef.value) {
          initializeGraph()
        } else {
          isLoading.value = false
          error.value = 'Graph view container has no dimensions'
        }
      }, 100)
      return
    }

    // Clear existing
    if (simulation) {
      simulation.stop()
    }

    // Create SVG
    svg = d3.select(svgRef.value)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // Create container group
    g = svg.append('g')

    // Setup zoom
    zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (g) {
          const { x, y, k } = event.transform
          g.attr('transform', `translate(${x},${y}) scale(${k})`)
        }
      })

    svg.call(zoom)

    // Initialize node positions randomly
    nodes.forEach((node) => {
      node.x = width / 2 + (Math.random() - 0.5) * 200
      node.y = height / 2 + (Math.random() - 0.5) * 200
      node.vx = 0
      node.vy = 0
      node.fx = undefined
      node.fy = undefined
    })

    // Calculate node degree for mass
    const nodeDegree = new Map<string, number>()
    nodes.forEach((node) => nodeDegree.set(node.uuid, 0))
    edges.forEach((edge) => {
      nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1)
      nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1)
    })

    // Create edges container (will be populated after force simulation setup)
    const edgesContainer = g.append('g').attr('class', 'edges')

    // Create nodes
    nodeElements = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGCircleElement, GraphNodeWithSimulation>('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d: GraphNodeWithSimulation) => {
        const degree = nodeDegree.get(d.uuid) || 0
        return Math.max(4, Math.min(12, 4 + degree * 0.5))
      })
      .attr('fill', (d: GraphNodeWithSimulation) => {
        if (selectedNode.value?.uuid === d.uuid) {
          return 'var(--color-accent)'
        }
        if (hoveredNode.value?.uuid === d.uuid) {
          return 'var(--color-accent)'
        }
        return 'var(--color-muted)'
      })
      .attr('fill-opacity', (d: GraphNodeWithSimulation) => {
        if (selectedNode.value?.uuid === d.uuid) {
          return 1
        }
        if (hoveredNode.value?.uuid === d.uuid) {
          return 0.8
        }
        return 0.5
      })
      .attr('stroke', 'var(--color-overlay-border)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'grab')
      .call(dragHandler as any)
      .on('mouseover', (_event: MouseEvent, d: GraphNodeWithSimulation) => {
        hoveredNode.value = d
        updateNodeStyles()
      })
      .on('mouseout', () => {
        hoveredNode.value = null
        updateNodeStyles()
      })
      .on('click', async (event: MouseEvent, d: GraphNodeWithSimulation) => {
        event.stopPropagation()

        // Ctrl+click opens the rune
        if ((event.ctrlKey || event.metaKey) && props.openRune) {
          try {
            await props.openRune(d.uuid)
          } catch (err) {
            console.error('Error opening rune:', err)
          }
          return
        }

        // Regular click selects/deselects the node
        selectedNode.value = selectedNode.value?.uuid === d.uuid ? null : d
        updateNodeStyles()
      })
      .on('dblclick', (event: MouseEvent, d: GraphNodeWithSimulation) => {
        event.stopPropagation()
        // Show neighborhood of this node
        centerNodeUuid.value = d.uuid
        cleanup()
        loadGraph()
      })

    // Create labels
    labelElements = g
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, GraphNodeWithSimulation>('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: GraphNodeWithSimulation) => {
        const degree = nodeDegree.get(d.uuid) || 0
        const radius = Math.max(4, Math.min(12, 4 + degree * 0.5))
        return radius + 14
      })
      .attr('font-size', '0.6875rem')
      .attr('fill', 'var(--color-muted)')
      .attr('fill-opacity', 0.8)
      .text((d: GraphNodeWithSimulation) => {
        // Strip directory prefix from title (show only filename)
        const title = d.title
        if (title.includes('/')) {
          const parts = title.split('/').filter((p) => p)
          return parts[parts.length - 1]
        }
        return title
      })
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Setup force simulation
    const linkForce = d3
      .forceLink<GraphNodeWithSimulation, GraphEdge>(edges)
      .id((d: GraphNodeWithSimulation) => d.uuid)
      .distance(SPRING_LENGTH)
      .strength(SPRING_STRENGTH)

    simulation = d3
      .forceSimulation<GraphNodeWithSimulation>(nodes)
      .force('link', linkForce)
      .force(
        'charge',
        d3.forceManyBody<GraphNodeWithSimulation>().strength((d) => {
          const degree = nodeDegree.get(d.uuid) || 0
          // Higher degree = more repulsion (heavier nodes)
          return -REPULSION_STRENGTH * (1 + degree * 0.1)
        }),
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(CENTERING_STRENGTH))
      .force(
        'collision',
        d3.forceCollide<GraphNodeWithSimulation>().radius((d: GraphNodeWithSimulation) => {
          const degree = nodeDegree.get(d.uuid) || 0
          return Math.max(4, Math.min(12, 4 + degree * 0.5)) + 2
        }),
      )
      .alpha(1)
      .alphaDecay(0.02)
      .velocityDecay(DAMPING)
      .on('tick', tick)

    // Get the processed links from the force (after source/target are converted to nodes)
    // forceLink modifies the edges array in place, converting source/target from strings to node objects
    const processedLinks = linkForce.links() as ProcessedEdge[]

    // Create edge elements using the processed links
    edgeElements = edgesContainer
      .selectAll<SVGLineElement, ProcessedEdge>('line')
      .data(processedLinks)
      .enter()
      .append('line')
      .attr('stroke', 'var(--color-overlay-border)')
      .attr('stroke-width', 1)

    // Custom tick function with velocity clamping and minimum threshold
    function tick() {
      if (!nodeElements || !edgeElements || !labelElements) return

      // Apply velocity clamping and minimum threshold
      nodes.forEach((node: GraphNodeWithSimulation) => {
        const vx = node.vx || 0
        const vy = node.vy || 0
        const speed = Math.sqrt(vx * vx + vy * vy)

        if (speed < MIN_VELOCITY_THRESHOLD) {
          node.vx = 0
          node.vy = 0
        } else if (speed > MAX_VELOCITY) {
          node.vx = (vx / speed) * MAX_VELOCITY
          node.vy = (vy / speed) * MAX_VELOCITY
        }
      })

      // Update edges (d3-force converts source/target from strings to node objects)
      edgeElements
        .attr('x1', (d: ProcessedEdge) => {
          const source = d.source as GraphNodeWithSimulation
          return source?.x ?? 0
        })
        .attr('y1', (d: ProcessedEdge) => {
          const source = d.source as GraphNodeWithSimulation
          return source?.y ?? 0
        })
        .attr('x2', (d: ProcessedEdge) => {
          const target = d.target as GraphNodeWithSimulation
          return target?.x ?? 0
        })
        .attr('y2', (d: ProcessedEdge) => {
          const target = d.target as GraphNodeWithSimulation
          return target?.y ?? 0
        })

      // Update nodes
      nodeElements
        .attr('cx', (d: GraphNodeWithSimulation) => d.x || 0)
        .attr('cy', (d: GraphNodeWithSimulation) => d.y || 0)

      // Update labels
      labelElements
        .attr('x', (d: GraphNodeWithSimulation) => d.x || 0)
        .attr('y', (d: GraphNodeWithSimulation) => d.y || 0)
    }

    // Drag handler
    function dragHandler(
      selection: d3.Selection<SVGCircleElement, GraphNodeWithSimulation, SVGGElement, unknown>,
    ) {
      const drag = d3
        .drag<SVGCircleElement, GraphNodeWithSimulation>()
        .filter((event: MouseEvent) => {
          // Don't start drag if Ctrl/Cmd is held (allow Ctrl+click to work)
          return !event.ctrlKey && !event.metaKey
        })
        .on(
          'start',
          (
            event: d3.D3DragEvent<
              SVGCircleElement,
              GraphNodeWithSimulation,
              GraphNodeWithSimulation
            >,
            d: GraphNodeWithSimulation,
          ) => {
            if (!event.active && simulation) {
              simulation.alphaTarget(0.3).restart()
            }
            draggedNode = d
            d.fx = d.x
            d.fy = d.y
            d.vx = 0
            d.vy = 0
            d3.select(event.sourceEvent.target as SVGCircleElement).style('cursor', 'grabbing')
          },
        )
        .on(
          'drag',
          (
            event: d3.D3DragEvent<
              SVGCircleElement,
              GraphNodeWithSimulation,
              GraphNodeWithSimulation
            >,
            d: GraphNodeWithSimulation,
          ) => {
            d.fx = event.x
            d.fy = event.y
          },
        )
        .on(
          'end',
          (
            event: d3.D3DragEvent<
              SVGCircleElement,
              GraphNodeWithSimulation,
              GraphNodeWithSimulation
            >,
            d: GraphNodeWithSimulation,
          ) => {
            if (!event.active && simulation) {
              simulation.alphaTarget(0)
            }
            d.fx = null
            d.fy = null
            draggedNode = null
            d3.select(event.sourceEvent.target as SVGCircleElement).style('cursor', 'grab')
          },
        )

      selection.call(drag)
    }

    function updateNodeStyles() {
      if (!nodeElements) return

      nodeElements
        .attr('fill', (d: GraphNodeWithSimulation) => {
          if (selectedNode.value?.uuid === d.uuid) {
            return 'var(--color-accent)'
          }
          if (hoveredNode.value?.uuid === d.uuid) {
            return 'var(--color-accent)'
          }
          return 'var(--color-muted)'
        })
        .attr('fill-opacity', (d: GraphNodeWithSimulation) => {
          if (selectedNode.value?.uuid === d.uuid) {
            return 1
          }
          if (hoveredNode.value?.uuid === d.uuid) {
            return 0.8
          }
          return 0.5
        })
    }

    // Handle window resize
    function handleResize() {
      if (!containerRef.value || !svg) return
      const width = containerRef.value.clientWidth
      const height = containerRef.value.clientHeight
      svg.attr('width', width).attr('height', height)
      if (simulation) {
        simulation.force(
          'center',
          d3.forceCenter(width / 2, height / 2).strength(CENTERING_STRENGTH),
        )
      }
    }

    window.addEventListener('resize', handleResize)
    resizeHandler = handleResize

    isLoading.value = false
  } catch (err) {
    console.error('Error initializing graph:', err)
    error.value = err instanceof Error ? err.message : 'Failed to initialize graph'
    isLoading.value = false
  }
}

function cleanup() {
  if (simulation) {
    simulation.stop()
    simulation = null
  }
  // Clear SVG content before removing handlers
  if (svg) {
    svg.on('.zoom', null)
    svg.selectAll('*').remove()
    svg = null
  } else if (svgRef.value) {
    // If svg d3 selection is null but ref exists, clear it directly
    const svgElement = d3.select(svgRef.value)
    svgElement.selectAll('*').remove()
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  nodeElements = null
  edgeElements = null
  labelElements = null
  g = null
  zoom = null
}

onMounted(() => {
  loadGraph()
})

onUnmounted(() => {
  if (titlePatternTimeout) {
    clearTimeout(titlePatternTimeout)
    titlePatternTimeout = null
  }
  cleanup()
})

// Computed hashtag options for dropdown
const hashtagOptions = computed(() => {
  return Array.from(availableHashtags.value.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([tag, count]) => ({
      label: `#${tag} (${count})`,
      value: tag,
    }))
})

// Reload graph when hashtag filter changes
watch(
  selectedHashtags,
  (newValue) => {
    // Normalize to array if null (when all deselected)
    if (newValue === null) {
      selectedHashtags.value = []
      return // The next watch will trigger with the empty array
    }
    if (sessionStore.hasOpenCodex) {
      // Note: Dropdown component should handle its own focus, but we'll ensure it stays visible
      cleanup()
      loadGraph()
    }
  },
  { deep: true },
)

// Reload graph when title pattern changes (with debounce)
watch(titlePattern, () => {
  if (titlePatternTimeout) {
    clearTimeout(titlePatternTimeout)
  }
  titlePatternTimeout = setTimeout(() => {
    if (sessionStore.hasOpenCodex) {
      // Store if input was focused before reload
      const wasFocused = document.activeElement === titleSearchInputRef.value
      cleanup()
      loadGraph().then(() => {
        // Restore focus after reload if it was focused before
        if (wasFocused && titleSearchInputRef.value) {
          nextTick(() => {
            titleSearchInputRef.value?.focus()
          })
        }
      })
    }
  }, 300) // Debounce title search
})

// Reload graph when codex changes
watch(
  () => sessionStore.hasOpenCodex,
  () => {
    if (sessionStore.hasOpenCodex) {
      cleanup()
      loadGraph()
    }
  },
)
</script>

<template>
  <div ref="containerRef" class="graph-view">
    <svg ref="svgRef" class="graph-svg"></svg>

    <!-- Graph Filters -->
    <div class="graph-filters">
      <!-- Back to Full View Button (when in neighborhood view) -->
      <button
        v-if="centerNodeUuid"
        class="graph-filter-back"
        @click="() => {
          centerNodeUuid = null
            cleanup()
            loadGraph()
          }
        "
        title="Back to full view"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>

      <!-- Title Search -->
      <div class="graph-filter-search">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref="titleSearchInputRef"
          v-model="titlePattern"
          type="text"
          class="graph-filter-input"
          placeholder="Search nodes..."
          :disabled="isLoading"
        />
      </div>

      <!-- Hashtag Filter -->
      <div class="graph-filter-dropdown">
        <Dropdown
          v-model="selectedHashtags"
          :options="hashtagOptions"
          placeholder="Filter by hashtags..."
          :multiple="true"
          :disabled="isLoading"
          max-height="12rem"
        />
      </div>
    </div>

    <div v-if="isLoading" class="overlay-state">
      <Loader message="Loading graph..." />
    </div>
    <div v-else-if="error && nodes.length === 0" class="overlay-state error-state">
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.graph-view {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: transparent;
}

.graph-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.overlay-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.error-state {
  color: var(--color-error);
  font-size: 0.875rem;
}

:deep(.nodes circle) {
  transition:
    fill 0.15s ease,
    fill-opacity 0.15s ease;
}

:deep(.edges line) {
  transition: stroke 0.15s ease;
}

:deep(.labels text) {
  font-family: var(--font-primary);
  font-weight: 400;
  letter-spacing: -0.01em;
}

.graph-filters {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.graph-filter-search {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-overlay-subtle);
  border: 1px solid var(--color-overlay-medium);
  border-radius: 6px;
  padding: 0.4rem 0.875rem;
  min-width: 12rem;
  transition: all 0.15s ease;
  backdrop-filter: blur(7px);
}

.graph-filter-search:focus-within {
  background: var(--color-overlay-subtle);
  border-color: var(--color-overlay-border);
}

.graph-filter-search svg {
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--color-muted);
  transition: opacity 0.15s ease;
}

.graph-filter-search:focus-within svg {
  opacity: 0.7;
}

.graph-filter-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  font-size: 0.75rem;
  font-family: var(--font-primary);
  font-weight: 400;
  outline: none;
  min-width: 0;
}

.graph-filter-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.graph-filter-input::placeholder {
  color: var(--color-muted);
  opacity: 0.5;
}

.graph-filter-dropdown {
  min-width: 12rem;
  backdrop-filter: blur(7px);
}

.graph-filter-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.875rem;
  background: var(--color-overlay-subtle);
  border: 1px solid var(--color-overlay-medium);
  border-radius: 6px;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-family: var(--font-primary);
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.graph-filter-back:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  border-color: var(--color-overlay-border);
}

.graph-filter-back svg {
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.graph-filter-back:hover svg {
  opacity: 0.7;
}

.graph-filter-back:focus-visible {
  border-color: var(--color-overlay-border);
}
</style>
