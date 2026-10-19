"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import Image from "next/image";
import { makePassportPhoto, validatePhoto, PhotoResult } from "@/lib/photo";

type Stage = "idle" | "processing" | "ready" | "paying";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const removeBackground = true;
  const [dragging, setDragging] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  async function processPhoto(file?: File) {
    if (!file) return;
    const problem = validatePhoto(file);
    if (problem) { setMessage(problem); return; }
    if (original) URL.revokeObjectURL(original);
    if (result) URL.revokeObjectURL(result.url);
    setMessage(""); setStage("processing"); setResult(null); setOrderId(null); setPaid(false);
    setOriginal(URL.createObjectURL(file));
    try {
      const photo = await makePassportPhoto(file, removeBackground);
      setResult(photo); setStage("ready");
      if (photo.backgroundRemoved) setMessage("Background removed on your device.");
      else setMessage("Photo ready. White background added; automatic background removal was unavailable, so check the edges before downloading.");
    } catch (error) {
      setStage("idle"); setMessage(error instanceof Error ? error.message : "Could not process that image. Try another photo.");
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) { void processPhoto(event.target.files?.[0]); }
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void processPhoto(event.dataTransfer.files?.[0]);
  }

  async function download() {
    if (!result) return;
    if (paid) { savePhoto(result); setMessage("Your verified photo has downloaded again. No new charge was made."); return; }
    setStage("paying"); setMessage("");
    try {
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        if (process.env.NODE_ENV === "production") throw new Error("Payments are not configured yet. Please try again later.");
        const ok = window.confirm("Development test mode — no real payment will be taken. Download the preview?\n\nConfigure Razorpay keys to accept real payments.");
        if (!ok) { setStage("ready"); return; }
        savePhoto(result); setMessage("Development test download. No payment was made."); setStage("ready"); return;
      }
      let order = orderId ? { id: orderId, amount: 7900, currency: "INR" } : null;
      if (!order) {
        const orderResponse = await fetch("/api/payment/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        order = await orderResponse.json();
        if (!orderResponse.ok) throw new Error((order as { error?: string }).error || "Could not start checkout.");
        setOrderId((order as { id: string }).id);
      }
      if (!order) throw new Error("Could not start checkout.");
      await loadCheckout();
      const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!Razorpay) throw new Error("Checkout could not load. Please try again.");
      await new Promise<void>((resolve, reject) => {
        const checkout = new Razorpay({ key: keyId, amount: order.amount, currency: "INR", name: "PhotoReady", description: "Passport photo download", order_id: order.id,
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const verify = await fetch("/api/payment/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response) });
              const data = await verify.json();
              if (!verify.ok || data.verified !== true) throw new Error(data.error || "Payment verification failed.");
              savePhoto(result); setPaid(true); setMessage("Payment verified. Your photo has downloaded."); resolve();
            } catch (error) { reject(error); }
          }, modal: { ondismiss: () => resolve() }, theme: { color: "#2559e8" } });
        checkout.open();
      });
      setStage("ready");
    } catch (error) { setStage("ready"); setMessage(error instanceof Error ? error.message : "Payment could not be completed."); }
  }

  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="PhotoReady home"><span className="brand-mark"><CameraIcon /></span><span>Photo<span className="brand-accent">Ready</span></span></a><a href="#how-it-works" className="top-link">How it works <span>↗</span></a></header>
    <section className="hero" id="top">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> YOUR PHOTO, PASSPORT-READY</div><h1>A passport photo,<br /><span>made simple.</span></h1><p className="hero-lede">Turn a well-lit selfie into a clean, print-ready 35 × 45 mm photo. No studio visit, no fuss.</p>
        <div className="hero-points"><div><span className="check">✓</span> Processed on your device</div><div><span className="check">✓</span> Ready in about a minute</div></div>
        <div className="price-note"><span className="price-rupee">₹</span><div><strong>₹79</strong><span> per paid download</span></div><span className="price-divider" /><span className="secure-note"><LockIcon /> Pay only when you’re happy</span></div>
      </div>
      <div className={`upload-card ${dragging ? "is-dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
        <div className="card-topline"><span className="step-tag">01 <span>/ 03</span></span><span className="privacy-tag"><LockIcon /> PRIVATE BY DESIGN</span></div>
        {stage === "idle" ? <>
          <div className="upload-icon"><UploadIcon /></div><h2>Start with a selfie</h2><p className="upload-hint">Face the camera in a bright, even light.<br />A plain background makes the best result.</p>
          <button className="primary-button" onClick={() => inputRef.current?.click()}>Choose a photo <span>↗</span></button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={handleChange} hidden />
          <div className="upload-meta"><span>JPG, PNG or WebP</span><i /> <span>Up to 12 MB</span><i /> <span>Drop it here</span></div>
        </> : <div className="editor">
          {stage === "processing" ? <div className="processing-state"><div className="spinner" /><h2>Preparing your photo</h2><p>Fitting the frame and refining the background. Everything stays in this browser.</p><div className="progress-track"><span /></div></div> : <>
            <div className="preview-heading"><div><span className="step-tag">02 <span>/ 03</span></span><h2>Your photo preview</h2></div><button className="text-button" onClick={() => { if (original) URL.revokeObjectURL(original); if (result) URL.revokeObjectURL(result.url); setOriginal(null); setStage("idle"); setResult(null); setMessage(""); }}>Start over</button></div>
            <div className="preview-wrap"><div className="portrait-frame">{result && <Image src={result.url} alt="Processed passport photo preview" width={413} height={531} unoptimized />}</div><div className="preview-details"><span className="ready-label"><i /> PREVIEW READY</span><strong>35 × 45 mm</strong><span>413 × 531 px · 300 DPI</span><span>JPEG · {result?.sizeKB} KB</span><span className="bg-status">{result?.backgroundRemoved ? "White background · refined" : "White background · review edges"}</span></div></div>
            <div className="preview-bottom"><span>Review the framing before payment.</span><button className="primary-button pay-button" onClick={() => void download()} disabled={stage === "paying"}>{stage === "paying" ? "Opening checkout…" : <>Download photo <span>₹79&nbsp; ↗</span></>}</button></div>
            {original && <details className="compare"><summary>Compare original and result</summary><div className="compare-row"><div><small>ORIGINAL</small><Image src={original} alt="Original selfie" width={100} height={82} unoptimized /></div><div><small>RESULT</small>{result && <Image src={result.url} alt="Processed result" width={100} height={82} unoptimized />}</div></div></details>}
          </>}
        </div>}
        {message && <p className={`status-message ${message.includes("verified") ? "success" : ""}`} role="status">{message}</p>}
        <div className="privacy-foot"><span className="shield"><LockIcon /></span><span>Your photo is processed in this browser and is never uploaded to our servers.</span></div>
      </div>
    </section>
    <div className="trust-strip"><div><span className="trust-icon"><ShieldIcon /></span><span><b>Private by default</b><small>Photos stay on your device</small></span></div><div><span className="trust-icon"><FrameIcon /></span><span><b>Print-ready sizing</b><small>35 × 45 mm · 300 DPI</small></span></div><div><span className="trust-icon"><SparkIcon /></span><span><b>Made for India</b><small>Passport-style format</small></span></div></div>
    <section className="how-section" id="how-it-works"><div className="section-heading"><div className="eyebrow">THREE EASY STEPS</div><h2>From selfie to <span>ready.</span></h2><p>Everything you need for a print-ready photo, in one quiet little flow.</p></div><div className="steps"><article><span className="step-num">01</span><div className="step-icon"><UploadIcon /></div><h3>Upload a selfie</h3><p>Choose a clear, front-facing photo with your full face visible and eyes open.</p></article><article><span className="step-num">02</span><div className="step-icon"><WandIcon /></div><h3>Review your preview</h3><p>We fit the frame and prepare a white background. Check the crop before you pay.</p></article><article><span className="step-num">03</span><div className="step-icon"><DownloadIcon /></div><h3>Download your photo</h3><p>Pay ₹79 securely, then get a compact JPEG ready to save and print.</p></article></div></section>
    <section className="notes-grid"><div className="note-card"><div className="eyebrow">A QUICK NOTE</div><h3>What happens to my photo?</h3><p>Image preparation runs locally in your browser. Razorpay handles checkout; we send it payment details only, never your selfie. Closing the page clears the working preview.</p></div><div className="note-card note-blue"><div className="eyebrow">BEFORE YOU SUBMIT</div><h3>Please check the latest rules</h3><p>This tool prepares the requested size and a plain background. It does not certify that your image meets every current Passport Seva or application-specific photo requirement. Please verify before submitting.</p></div></section>
    <section className="faq-section"><div className="section-heading"><div className="eyebrow">GOOD TO KNOW</div><h2>A few <span>answers.</span></h2></div><div className="faq-list"><details><summary>Does this use AI?</summary><p>Background removal uses an open-source model that runs in your browser when available. We do not call a paid AI service or alter facial features. Suit replacement is not included.</p></details><details><summary>Will it meet every passport photo requirement?</summary><p>The file is sized to 35 × 45 mm at 300 DPI. Requirements can vary and may change; we can’t certify compliance. Please check the latest official instructions for your application.</p></details><details><summary>What if background removal doesn’t work?</summary><p>The photo is still cropped and placed on white, but the original background may remain around you. Review the preview edges carefully and try a selfie taken against a plain wall.</p></details><details><summary>Can I download without paying?</summary><p>In development only, the local preview can be downloaded using a clearly labeled test-mode prompt. Production checkout requires a verified Razorpay payment of ₹79.</p></details></div></section>
    <footer><a className="brand footer-brand" href="#top"><span className="brand-mark"><CameraIcon /></span><span>Photo<span className="brand-accent">Ready</span></span></a><span className="footer-disclaimer">A helpful photo tool, not an official passport service.</span><div className="footer-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/privacy#contact">Contact</a></div><small>© 2026 PhotoReady</small></footer>
  </main>;
}

function savePhoto(result: PhotoResult) { const link = document.createElement("a"); link.href = result.url; link.download = "passport-photo-35x45mm.jpg"; link.click(); }
function loadCheckout() { return new Promise<void>((resolve, reject) => { if (document.querySelector("script[data-razorpay]")) { resolve(); return; } const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.dataset.razorpay = "true"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Could not load secure checkout.")); document.body.appendChild(script); }); }
function CameraIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3A1.5 1.5 0 0 1 21.5 9v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="13.3" r="3.5" stroke="currentColor" strokeWidth="1.6"/></svg>; }
function UploadIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 15v4.5h15V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 16 16" fill="none"><rect x="3.2" y="7" width="9.6" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.3"/><path d="M5.3 7V5a2.7 2.7 0 0 1 5.4 0v2" stroke="currentColor" strokeWidth="1.3"/></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 19 6v5.2c0 4.5-2.9 7.5-7 9.3-4.1-1.8-7-4.8-7-9.3V6l7-2.5Z" stroke="currentColor" strokeWidth="1.6"/><path d="m9 11.8 2 2 4-4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function FrameIcon() { return <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5"/><path d="M8.3 17c.6-2 1.8-3 3.7-3s3.1 1 3.7 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function SparkIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>; }
function WandIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="m4 20 12.8-12.8 3 3L7 23.0 4 20Z" transform="translate(0 -2)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m16 4 .6-2M20 7l2-.7M18.5 2.5l-.4 2M21 5l-2 .4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
