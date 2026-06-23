import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import ResearchLogPanel from './components/ui/ResearchLogPanel';
import './index.css';

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
