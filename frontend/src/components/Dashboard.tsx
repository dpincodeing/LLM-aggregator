
import { RefreshCw, Upload, MoreHorizontal, ArrowRight } from 'lucide-react';

const ModelsTable = ({ title, models }: { title: string, models: any[] }) => {
  return (
    <div className="table-section">
      <div className="table-header-row">
        <h3>{title}</h3>
        <button className="btn-upload">
          <Upload size={14} /> UPLOAD WEIGHT
        </button>
      </div>
      
      <table className="models-table">
        <thead>
          <tr>
            <th>Name ↑↓</th>
            <th>Base Model ↑↓</th>
            <th>Author ↑↓</th>
            <th>Pricing ↑↓</th>
            <th>API Key ↑↓</th>
            <th>Status ↑↓</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {models.map((m, i) => (
            <tr key={i} className={i === 2 ? 'active-row' : ''}>
              <td>{m.name}</td>
              <td>{m.base}</td>
              <td>{m.author}</td>
              <td>{m.pricing}</td>
              <td className="font-mono">{m.key}</td>
              <td>
                <div className="status-badge">
                  <div className="status-dot"></div> {m.status}
                </div>
              </td>
              <td>
                <button className="more-btn">
                  <MoreHorizontal size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Dashboard = () => {
  const customModels = [
    { name: 'Banking LLM', base: 'Llama2-7B', author: 'Meta', pricing: '$ 0.0001', key: 'ak39•••••••••5cx9', status: 'LIVE' },
    { name: 'Customer Support LLM', base: 'Mistral 7B', author: 'Mistral', pricing: '$ 0.0001', key: 'ak39•••••••••5cx9', status: 'LIVE' },
    { name: 'My Coder LLM', base: 'Meta', author: 'Meta', pricing: '$ 0.00015', key: 'ak39•••••••••5cx9', status: 'LIVE' },
    { name: 'Recommendation Engine LLM', base: 'Mistral AI', author: 'Mistral', pricing: '$ 0.0001', key: 'ak39•••••••••5cx9', status: 'LIVE' },
    { name: 'Appointment Taker LLM', base: 'Gemma2 7B', author: 'Google', pricing: '$ 0.00017', key: 'ak39•••••••••5cx9', status: 'LIVE' },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2><BoxIcon /> Models</h2>
        <div className="last-updated">
          <RefreshCw size={14} /> Updated 4 hours ago
        </div>
      </div>
      
      <div className="stats-row">
        <div className="stats-card glass-pane">
          <div className="stat-item">
            <div className="stat-value">96</div>
            <div className="stat-bar-container">
              <span className="stat-label">93%</span>
              <div className="stat-bar">
                <div className="stat-bar-fill purple" style={{ width: '93%' }}></div>
              </div>
              <span className="stat-label">Live Models</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-value">8</div>
            <div className="stat-bar-container">
              <span className="stat-label">7%</span>
              <div className="stat-bar">
                <div className="stat-bar-fill pink" style={{ width: '7%' }}></div>
              </div>
              <span className="stat-label">Inactive models</span>
            </div>
          </div>
        </div>
        
        <div className="wizard-card">
          <div className="wizard-graphic">▲</div>
          <h3>Having a problem with LLM models?</h3>
          <p>Activate smart wizard to add multiple models into your library to start using them instantly</p>
          <a href="#" className="wizard-link">GET STARTED <ArrowRight size={14} /></a>
        </div>
      </div>
      
      <ModelsTable title="Your models" models={customModels} />
      <ModelsTable title="Base models" models={customModels.slice(0, 1)} />
    </div>
  );
};

const BoxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

export default Dashboard;
