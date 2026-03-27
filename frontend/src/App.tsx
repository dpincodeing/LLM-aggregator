
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="content-area">
        <ChatInterface />
      </div>
    </div>
  );
}

export default App;
