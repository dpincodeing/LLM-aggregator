
import { ArrowUpRight } from 'lucide-react';

const Hero = () => {
  return (
    <div className="hero">
      <div className="hero-pill">
        Version 1.2 Public Beta <ArrowUpRight size={14} />
      </div>
      
      <h1>Fine-tuning and Inferencing<br/>for Open-Source LLMs</h1>
      
      <p>
        Bring your datasets. Fine-tune multiple LLMs. Start inferencing in one-click<br/>
        Sit back and watch them scale to millions !
      </p>
      
      <div className="hero-actions">
        <button className="btn btn-primary">Request Access</button>
        <button className="btn btn-secondary">Book a Demo</button>
      </div>
    </div>
  );
};

export default Hero;
