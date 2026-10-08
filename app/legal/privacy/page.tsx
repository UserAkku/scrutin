export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl uppercase mb-8">Privacy Policy</h1>
      <div className="prose prose-brutal max-w-none">
        <p className="font-bold">Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2 className="font-display text-2xl uppercase mt-8 mb-4">1. Information We Collect</h2>
        <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, password, postal address, profile picture, and other information you choose to provide.</p>
        
        <h2 className="font-display text-2xl uppercase mt-8 mb-4">2. How We Use Information</h2>
        <p>We may use the information we collect from you to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Provide, maintain, and improve our services.</li>
          <li>Process transactions and send related information.</li>
          <li>Send you technical notices, updates, security alerts, and support and administrative messages.</li>
          <li>Respond to your comments, questions, and requests and provide customer service.</li>
        </ul>

        <h2 className="font-display text-2xl uppercase mt-8 mb-4">3. Third Party Services</h2>
        <p>We use third-party services like Google for authentication and Brevo for transactional emails. These services have their own privacy policies.</p>

        <h2 className="font-display text-2xl uppercase mt-8 mb-4">4. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:akhileshkumaroffical@gmail.com" className="underline">akhileshkumaroffical@gmail.com</a></p>
      </div>
    </div>
  );
}
