import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUIStore } from './store/ui'
import { Layout } from './components/Layout'
import { Documents } from './pages/Documents'
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
      case 'documents':
        return <Documents />
      case 'update':
        return <Update />
      case 'settings':
        return <Settings />
      default:
        return <Documents />
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
