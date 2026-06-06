import SignContractModal from "@/components/SignContractModal";

export default function Home() {
  return (
    <main className="page">
      <div className="card">
        <h1>Welcome to Acme</h1>
        <p>
          To activate your account, please review and sign your service
          agreement. Signing happens right here — you won&apos;t be redirected
          anywhere.
        </p>
        <SignContractModal />
      </div>
    </main>
  );
}
