import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Link2, 
  Layers, 
  ArrowRight, 
  Sparkles,
  ChevronDown
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: Layers,
      title: 'Hierarchical Outlines',
      description: 'Structure your thoughts with infinite nesting and smart indentation'
    },
    {
      icon: Link2,
      title: 'Connected Documents',
      description: 'Link outlines together to build interconnected knowledge networks'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered',
      description: 'Generate outlines and extract entities with intelligent assistance'
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.03)_0%,transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.05)_0%,transparent_50%)]" />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Outline</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/auth')}
          className="text-muted-foreground hover:text-foreground"
        >
          Sign in
        </Button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-sm text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Now with AI outline generation</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-foreground via-foreground to-muted-foreground/70 bg-clip-text text-transparent">
            Structure your ideas.
            <br />
            <span className="text-primary">Connect everything.</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            A minimalist outline editor that lets you organize thoughts hierarchically 
            and link documents together seamlessly.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button 
              size="lg"
              onClick={() => navigate('/')}
              className="gap-2 px-6 shadow-lg shadow-primary/20"
            >
              Start writing
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => {
                document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="gap-2"
            >
              See it in action
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Demo Preview */}
        <div id="demo" className="relative">
          {/* Glow effect behind */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent blur-3xl -z-10" />
          
          {/* Browser chrome mockup */}
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/5 overflow-hidden">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-background/50 text-xs text-muted-foreground flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  outline.app
                </div>
              </div>
            </div>
            
            {/* Editor preview mockup */}
            <div className="p-6 sm:p-8 bg-gradient-to-br from-background via-background to-muted/20">
              <div className="space-y-3 font-mono text-sm">
                {/* Outline items */}
                <div className="flex items-start gap-3">
                  <span className="text-muted-foreground/50 w-6 text-right">I.</span>
                  <span className="text-foreground">Project Overview</span>
                </div>
                <div className="flex items-start gap-3 pl-8">
                  <span className="text-muted-foreground/50 w-6 text-right">A.</span>
                  <span className="text-foreground">Goals and objectives</span>
                </div>
                <div className="flex items-start gap-3 pl-8">
                  <span className="text-muted-foreground/50 w-6 text-right">B.</span>
                  <span className="text-primary underline decoration-primary/30 cursor-pointer hover:decoration-primary transition-colors">
                    Research findings →
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-muted-foreground/50 w-6 text-right">II.</span>
                  <span className="text-foreground">Implementation plan</span>
                </div>
                <div className="flex items-start gap-3 pl-8">
                  <span className="text-muted-foreground/50 w-6 text-right">A.</span>
                  <span className="text-foreground">Phase 1: Discovery</span>
                </div>
                <div className="flex items-start gap-3 pl-16">
                  <span className="text-muted-foreground/50 w-6 text-right">1.</span>
                  <span className="text-muted-foreground">User interviews</span>
                </div>
                <div className="flex items-start gap-3 pl-16">
                  <span className="text-muted-foreground/50 w-6 text-right">2.</span>
                  <span className="text-muted-foreground">Competitive analysis</span>
                </div>
                
                {/* Cursor blink effect */}
                <div className="flex items-start gap-3 pl-8">
                  <span className="text-muted-foreground/50 w-6 text-right">B.</span>
                  <span className="text-foreground">
                    Phase 2: Design
                    <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-card/50"
              onMouseEnter={() => setHoveredFeature(index)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300
                ${hoveredFeature === index ? 'bg-primary/10' : 'bg-muted/50'}
              `}>
                <feature.icon className={`
                  w-5 h-5 transition-colors duration-300
                  ${hoveredFeature === index ? 'text-primary' : 'text-muted-foreground'}
                `} />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 text-center">
          <p className="text-muted-foreground mb-4">
            Ready to organize your thoughts?
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/')}
            className="gap-2 px-8"
          >
            Get started — it's free
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Outline</span>
          </div>
          <p>Built with precision.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
