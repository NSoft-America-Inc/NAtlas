import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUIStore } from './store/ui'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Documents } from './pages/Documents'
import { Wiki } from './pages/Wiki'
import { Query } from './pages/Query'
import { Update } from './pages/Update'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App(): React.JSX.Element {
  const { activeTab } = useUIStore()

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'documents':
        return <Documents />
      case 'wiki':
        return <Wiki />
      case 'query':
        return <Query />
      case 'update':
        return <Update />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        {renderContent()}
      </Layout>
    </QueryClientProvider>
  )
}

export default App
