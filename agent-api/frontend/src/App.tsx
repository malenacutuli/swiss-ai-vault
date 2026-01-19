import { Route, Router } from 'wouter'
import { Toaster } from 'sonner'

// Pages (to be implemented)
import Dashboard from './pages/Dashboard'
import Versions from './pages/Versions'
import Templates from './pages/Templates'
import ABTests from './pages/ABTests'
import Metrics from './pages/Metrics'
import Optimizer from './pages/Optimizer'

function App() {
  return (
    <>
      <Router>
        <Route path="/" component={Dashboard} />
        <Route path="/versions" component={Versions} />
        <Route path="/templates" component={Templates} />
        <Route path="/ab-tests" component={ABTests} />
        <Route path="/metrics" component={Metrics} />
        <Route path="/optimizer" component={Optimizer} />
      </Router>
      <Toaster position="top-right" />
    </>
  )
}

export default App
