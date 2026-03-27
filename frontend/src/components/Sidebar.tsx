
import { MessageSquare, Key, Settings, Compass } from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Compass size={28} />
      </div>
      
      <div className="sidebar-icon active" title="Chat">
        <MessageSquare size={20} />
      </div>
      <div className="sidebar-icon" title="Add LLM APIs">
        <Key size={20} />
      </div>
      <div className="sidebar-icon" title="Settings">
        <Settings size={20} />
      </div>
    </div>
  );
};

export default Sidebar;
