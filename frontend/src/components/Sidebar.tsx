import { MessageSquare, Key, Settings, Compass, Layout } from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <Compass size={24} className="sidebar-logo-icon" />
        <span>LLM Aggregator</span>
      </div>
      
      <div className="sidebar-nav">
        <div className="sidebar-item active">
          <MessageSquare size={18} />
          <span>Chat interface</span>
        </div>
        <div className="sidebar-item">
          <Layout size={18} />
          <span>Dashboard</span>
        </div>
        <div className="sidebar-item">
          <Key size={18} />
          <span>API Keys</span>
        </div>
      </div>

      <div className="sidebar-nav" style={{ marginTop: 'auto' }}>
        <div className="sidebar-item">
          <Settings size={18} />
          <span>Settings</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
