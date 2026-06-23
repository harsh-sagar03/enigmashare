import { Link } from 'react-router-dom';
import { FiShield, FiLock, FiClock, FiDownload, FiArrowRight, FiGlobe } from 'react-icons/fi';

const features = [
  {
    icon: FiLock,
    title: 'End-to-End Encryption',
    description: 'Files are encrypted in your browser with AES-256-GCM before upload. Not even we can read them.',
  },
  {
    icon: FiClock,
    title: 'Auto-Expiring Links',
    description: 'Set precise expiration times and download limits. Access is automatically revoked when conditions are met.',
  },
  {
    icon: FiDownload,
    title: 'Download Limits',
    description: 'Control exactly how many times a file can be downloaded. Once the limit is reached, the link dies.',
  },
  {
    icon: FiGlobe,
    title: 'Zero-Knowledge Design',
    description: 'Decryption keys are never stored on our servers. Share them with your recipient through a separate channel.',
  },
];

const steps = [
  {
    step: '1',
    title: 'Select Files',
    description: 'Choose one or more files to share. They\'re zipped and encrypted in your browser before anything is uploaded.',
  },
  {
    step: '2',
    title: 'Set Rules',
    description: 'Choose an expiration time, download limit, and optional password protection for extra security.',
  },
  {
    step: '3',
    title: 'Share the Link',
    description: 'Copy the share link and send the decryption key through a separate channel — like a message or email.',
  },
  {
    step: '4',
    title: 'Recipient Decrypts',
    description: 'The recipient downloads the encrypted file and decrypts it in their browser using the key you provided.',
  },
];

export default function Landing() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent opacity-60" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-8 backdrop-blur-sm">
              <FiShield className="w-3 h-3" />
              Zero-knowledge file sharing
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              Send Files with{' '}
              <span className="text-accent">Total Privacy</span>
            </h1>
            <p className="text-lg text-foreground/50 max-w-xl mx-auto mb-10 leading-relaxed">
              Your files are encrypted in your browser before they ever reach our servers. 
              Set expiration dates, download limits, and optional passwords — then share with confidence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/share/new"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer"
              >
                Start Sharing
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground/60 font-medium text-sm hover:bg-muted transition-all duration-200 cursor-pointer"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-foreground/50 max-w-lg mx-auto">
              Designed from the ground up to keep your data private, with a simple flow that takes seconds.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl bg-muted/30 backdrop-blur-sm border border-border hover:bg-muted/60 hover:border-accent/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors duration-200">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-heading font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">Simple 4-Step Flow</h2>
            <p className="text-foreground/50 max-w-lg mx-auto">
              From selecting files to secure delivery — it only takes a few clicks.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold flex items-center justify-center mx-auto mb-4 text-lg">
                  {item.step}
                </div>
                <h3 className="font-heading font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center p-12 rounded-3xl bg-muted/30 backdrop-blur-sm border border-border">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <FiShield className="w-6 h-6 text-accent" />
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">Ready to share securely?</h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto">
              Sign in to send end-to-end encrypted files and manage your shares.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer"
            >
              Sign In
              <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
