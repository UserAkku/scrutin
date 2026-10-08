export default function RefundPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl uppercase mb-8">Refund Policy</h1>
      <div className="prose prose-brutal max-w-none">
        <p className="font-bold">Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2 className="font-display text-2xl uppercase mt-8 mb-4">1. Subscription Cancellations</h2>
        <p>You can cancel your Pro subscription at any time. If you cancel, you will retain access to Pro features until the end of your current billing period. We do not provide prorated refunds for mid-cycle cancellations.</p>
        
        <h2 className="font-display text-2xl uppercase mt-8 mb-4">2. Refunds</h2>
        <p>We offer a 7-day money-back guarantee for initial subscription purchases. If you are not satisfied with Krillo Pro within the first 7 days of your first payment, please contact us for a full refund.</p>
        <p>After 7 days, or for renewal payments, refunds are generally not provided, subject to our discretion in exceptional circumstances.</p>

        <h2 className="font-display text-2xl uppercase mt-8 mb-4">3. Contact for Refunds</h2>
        <p>To request a refund within the eligible period, please contact us at: <a href="mailto:akhileshkumaroffical@gmail.com" className="underline">akhileshkumaroffical@gmail.com</a></p>
      </div>
    </div>
  );
}
