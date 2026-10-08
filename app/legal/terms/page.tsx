export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl uppercase mb-8">Terms of Service</h1>
      <div className="prose prose-brutal max-w-none">
        <p className="font-bold">Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2 className="font-display text-2xl uppercase mt-8 mb-4">1. Agreement to Terms</h2>
        <p>By accessing or using Krillo, you agree to be bound by these Terms. If you disagree with any part of the terms, then you do not have permission to access the Service.</p>
        
        <h2 className="font-display text-2xl uppercase mt-8 mb-4">2. Description of Service</h2>
        <p>Krillo provides industrial-grade website auditing tools. We offer both free and paid (Pro) plans. Free plans have access to limited features, while Pro plans unlock full capabilities.</p>

        <h2 className="font-display text-2xl uppercase mt-8 mb-4">3. Prohibited Use</h2>
        <p>You may not use the Service for any illegal or unauthorized purpose. You must not, in the use of the Service, violate any laws in your jurisdiction.</p>

        <h2 className="font-display text-2xl uppercase mt-8 mb-4">4. Limitation of Liability</h2>
        <p>In no event shall Krillo, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>

        <h2 className="font-display text-2xl uppercase mt-8 mb-4">5. Governing Law</h2>
        <p>These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p>
      </div>
    </div>
  );
}
