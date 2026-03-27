
import { Zap, Server, MousePointerClick } from 'lucide-react';

const Features = () => {
  return (
    <div className="features-section">
      <div className="features-header">
        <div className="pill">PRODUCTS</div>
        <h2>Infrastructure-as-a-Service for LLMs</h2>
        <p>Out-of-the-box infrastructure for fine-tuning and inferencing open-source models, allowing you to be ready to scale from day 1</p>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-card-icon">
            <Zap size={32} color="var(--accent-secondary)" />
          </div>
          <h3>Serverless APIs</h3>
          <p>Get the fastest inference endpoints and lowest latencies without managing infrastructure.</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-card-icon">
            <Server size={32} color="#00ffaa" />
          </div>
          <h3>Dedicated Deployment</h3>
          <p>Get real-time auto-scaling, customizable security protocols, and 24/7 technical support.</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-card-icon">
            <MousePointerClick size={32} color="var(--accent-primary)" />
          </div>
          <h3>1-Click Deployment</h3>
          <p>Deploy your models for inferencing with just 1-click. No complex CLIs or notebooks needed.</p>
        </div>
      </div>
    </div>
  );
};

export default Features;
