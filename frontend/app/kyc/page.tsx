'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Shield, CheckCircle2, XCircle, Clock, Upload, Loader2,
    AlertCircle, ArrowLeft, Camera, FileText, User, Calendar,
    CreditCard, RefreshCw, Fingerprint,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface KYCSubmission {
    submission_id: number;
    status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
    full_name: string;
    document_type: string;
    wallet_address: string | null;
    rejection_reason: string | null;
    reviewed_at: string | null;
    created_at: string;
}

const DOC_TYPES = [
    { value: 'CCCD', label: 'CCCD / Căn cước công dân' },
    { value: 'PASSPORT', label: 'Hộ chiếu (Passport)' },
    { value: 'DRIVER_LICENSE', label: 'Bằng lái xe' },
];

/* ── Upload helper ──────────────────────────────────────────────────────── */
function FileUploadBox({
    label, icon, file, onFileChange, uploadedUrl,
}: {
    label: string;
    icon: React.ReactNode;
    file: File | null;
    onFileChange: (f: File | null) => void;
    uploadedUrl: string | null;
}) {
    return (
        <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                {icon} {label}
            </label>
            <div
                className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-[#f0b90b]/50 ${
                    uploadedUrl ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card'
                }`}
                onClick={() => document.getElementById(`file-${label}`)?.click()}
            >
                <input
                    id={`file-${label}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        onFileChange(f);
                    }}
                />
                {uploadedUrl ? (
                    <div className="flex items-center gap-2 justify-center text-sm text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Đã tải lên</span>
                    </div>
                ) : file ? (
                    <div className="flex items-center gap-2 justify-center text-sm">
                        <FileText className="w-4 h-4 text-[#f0b90b]" />
                        <span className="truncate max-w-[200px]">{file.name}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="w-5 h-5" />
                        <span className="text-xs">Nhấn để tải ảnh lên</span>
                        <span className="text-[10px]">JPEG, PNG, WebP · Max 5MB</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Status Display ─────────────────────────────────────────────────────── */
function StatusDisplay({ submission }: { submission: KYCSubmission }) {
    const statusConfig = {
        PENDING: {
            color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
            icon: <Clock className="w-6 h-6" />,
            title: 'Đang chờ xét duyệt',
            desc: 'Yêu cầu KYC của bạn đã được gửi thành công. Admin sẽ xem xét trong thời gian sớm nhất.',
        },
        REVIEWING: {
            color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
            icon: <Fingerprint className="w-6 h-6" />,
            title: 'Đang xác minh',
            desc: 'Admin đang xem xét hồ sơ KYC của bạn. Quá trình này có thể mất 1-2 ngày làm việc.',
        },
        APPROVED: {
            color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
            icon: <CheckCircle2 className="w-6 h-6" />,
            title: 'Đã xác minh ✓',
            desc: 'KYC của bạn đã được phê duyệt. Bạn có thể tham gia đầu tư RWA và các tính năng nâng cao.',
        },
        REJECTED: {
            color: 'text-red-400 bg-red-400/10 border-red-400/20',
            icon: <XCircle className="w-6 h-6" />,
            title: 'Bị từ chối',
            desc: 'Yêu cầu KYC chưa đạt yêu cầu. Vui lòng xem lý do và gửi lại hồ sơ.',
        },
    };

    const cfg = statusConfig[submission.status];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border rounded-2xl p-6 space-y-4 ${cfg.color}`}
        >
            <div className="flex items-center gap-3">
                {cfg.icon}
                <div>
                    <h2 className="font-black text-lg">{cfg.title}</h2>
                    <p className="text-sm opacity-80">{cfg.desc}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-xs opacity-60">Họ và tên</p>
                    <p className="font-semibold">{submission.full_name}</p>
                </div>
                <div>
                    <p className="text-xs opacity-60">Loại giấy tờ</p>
                    <p className="font-semibold">{DOC_TYPES.find(d => d.value === submission.document_type)?.label || submission.document_type}</p>
                </div>
                <div>
                    <p className="text-xs opacity-60">Ngày gửi</p>
                    <p className="font-semibold">{new Date(submission.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
                {submission.reviewed_at && (
                    <div>
                        <p className="text-xs opacity-60">Ngày xét duyệt</p>
                        <p className="font-semibold">{new Date(submission.reviewed_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                )}
            </div>

            {submission.status === 'REJECTED' && submission.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm">
                    <p className="font-bold text-red-400 mb-1">Lý do từ chối:</p>
                    <p className="text-red-300">{submission.rejection_reason}</p>
                </div>
            )}
        </motion.div>
    );
}

/* ── Main KYC Page ──────────────────────────────────────────────────────── */
export default function KYCPage() {
    const { data: session } = useSession();
    const { address } = useAccount();

    const [submission, setSubmission] = useState<KYCSubmission | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);

    // Form state
    const [fullName, setFullName] = useState('');
    const [dob, setDob] = useState('');
    const [docType, setDocType] = useState('CCCD');
    const [docNumber, setDocNumber] = useState('');

    // File state
    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [frontUrl, setFrontUrl] = useState<string | null>(null);
    const [backUrl, setBackUrl] = useState<string | null>(null);
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

    // Fetch KYC status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await apiClient.get('/api/kyc/status');
            setSubmission(res.data.submission || null);
        } catch {
            // Not logged in or no submission
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session) fetchStatus();
        else setLoading(false);
    }, [session, fetchStatus]);

    // Upload individual document
    const uploadDocument = async (file: File, fieldName: string) => {
        setUploading(fieldName);
        try {
            const formData = new FormData();
            formData.append('file', file);
            // IMPORTANT: do NOT set Content-Type manually for FormData uploads.
            // The axios client has a default `Content-Type: application/json`
            // — when we override it to 'multipart/form-data' without a
            // boundary string, the server cannot parse the body and multer
            // returns "Unexpected end of form" / req.file = undefined.
            // Setting the header to undefined makes axios delete the inherited
            // header and re-derive the proper `multipart/form-data; boundary=...`.
            const res = await apiClient.post('/api/kyc/upload-document', formData, {
                headers: { 'Content-Type': undefined as unknown as string },
            });
            return res.data.url as string;
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.error || `Tải ảnh ${fieldName} thất bại`;
            toast.error(msg);
            return null;
        } finally {
            setUploading(null);
        }
    };

    // Handle file change & upload immediately
    const handleFileChange = async (
        file: File | null,
        fieldName: string,
        setFile: (f: File | null) => void,
        setUrl: (u: string | null) => void,
    ) => {
        setFile(file);
        if (file) {
            const url = await uploadDocument(file, fieldName);
            if (url) setUrl(url);
        } else {
            setUrl(null);
        }
    };

    // Submit KYC
    const handleSubmit = async () => {
        if (!fullName.trim()) return toast.error('Vui lòng nhập họ và tên');
        if (!dob) return toast.error('Vui lòng chọn ngày sinh');
        if (!docNumber.trim()) return toast.error('Vui lòng nhập số giấy tờ');
        if (!frontUrl) return toast.error('Vui lòng tải ảnh mặt trước giấy tờ');

        setSubmitting(true);
        try {
            await apiClient.post('/api/kyc/submit', {
                full_name: fullName.trim(),
                date_of_birth: dob,
                document_type: docType,
                document_number: docNumber.trim(),
                wallet_address: address || null,
                document_front: frontUrl,
                document_back: backUrl,
                selfie_url: selfieUrl,
            });
            toast.success('Yêu cầu KYC đã được gửi thành công! 🎉');
            fetchStatus();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Gửi KYC thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    // Show form: no submission, or REJECTED (allow resubmit)
    const showForm = !submission || submission.status === 'REJECTED';

    return (
        <div className="min-h-screen bg-background flex flex-col relative">
            <Header />

            {/* Grid background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(240,185,11,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(240,185,11,0.03) 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                    }}
                />
            </div>

            <main className="flex-1 relative z-10">
                {/* Header section */}
                <div className="border-b border-border bg-gradient-to-br from-background via-[#f0b90b]/5 to-background">
                    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-14">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <Link href="/assets" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
                                <ArrowLeft className="w-3.5 h-3.5" /> Quay lại RWA
                            </Link>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 bg-[#f0b90b]/10 rounded-xl border border-[#f0b90b]/20">
                                    <Shield className="w-7 h-7 text-[#f0b90b]" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black">Xác minh danh tính (KYC)</h1>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        Hoàn tất KYC để mở khóa đầu tư RWA & các tính năng nâng cao
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10 space-y-6">
                    {!session ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Shield className="w-14 h-14 text-muted-foreground/20" />
                            <p className="text-muted-foreground">Đăng nhập để bắt đầu xác minh KYC</p>
                            <Link
                                href={buildLoginRedirectUrl('/kyc')}
                                className="px-5 py-2.5 bg-[#f0b90b] text-black font-bold rounded-xl text-sm"
                            >
                                Đăng nhập
                            </Link>
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-[#f0b90b]" />
                        </div>
                    ) : (
                        <>
                            {/* Status display (if submission exists) */}
                            {submission && <StatusDisplay submission={submission} />}

                            {/* Steps indicator */}
                            {showForm && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                    <div className="flex items-center justify-center gap-3 mb-6">
                                        {[
                                            { step: 1, label: 'Thông tin', icon: <User className="w-4 h-4" /> },
                                            { step: 2, label: 'Giấy tờ', icon: <CreditCard className="w-4 h-4" /> },
                                            { step: 3, label: 'Xác nhận', icon: <CheckCircle2 className="w-4 h-4" /> },
                                        ].map((s) => (
                                            <div key={s.step} className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-[#f0b90b]">
                                                    <div className="w-6 h-6 rounded-full bg-[#f0b90b]/10 border border-[#f0b90b]/30 flex items-center justify-center">
                                                        {s.icon}
                                                    </div>
                                                    <span className="hidden sm:inline">{s.label}</span>
                                                </div>
                                                {s.step < 3 && <div className="w-8 h-px bg-border" />}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* KYC Form */}
                            {showForm && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-card border border-border rounded-2xl p-6 space-y-6"
                                >
                                    <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                                        {submission?.status === 'REJECTED' ? 'Gửi lại hồ sơ KYC' : 'Thông tin cá nhân'}
                                    </h2>

                                    {/* Personal info */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                <User className="w-3 h-3" /> Họ và tên *
                                            </label>
                                            <input
                                                value={fullName}
                                                onChange={e => setFullName(e.target.value)}
                                                placeholder="Nguyễn Văn A"
                                                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-[#f0b90b]/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> Ngày sinh *
                                            </label>
                                            <input
                                                type="date"
                                                value={dob}
                                                onChange={e => setDob(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-[#f0b90b]/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Document info */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                <CreditCard className="w-3 h-3" /> Loại giấy tờ *
                                            </label>
                                            <select
                                                value={docType}
                                                onChange={e => setDocType(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-[#f0b90b]/50"
                                            >
                                                {DOC_TYPES.map(d => (
                                                    <option key={d.value} value={d.value}>{d.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                <FileText className="w-3 h-3" /> Số giấy tờ *
                                            </label>
                                            <input
                                                value={docNumber}
                                                onChange={e => setDocNumber(e.target.value)}
                                                placeholder="VD: 012345678901"
                                                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-[#f0b90b]/50"
                                            />
                                        </div>
                                    </div>

                                    <hr className="border-border" />

                                    {/* Document uploads */}
                                    <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                                        Ảnh giấy tờ
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <FileUploadBox
                                            label="Mặt trước *"
                                            icon={<CreditCard className="w-3 h-3" />}
                                            file={frontFile}
                                            uploadedUrl={frontUrl}
                                            onFileChange={f => handleFileChange(f, 'front', setFrontFile, setFrontUrl)}
                                        />
                                        <FileUploadBox
                                            label="Mặt sau"
                                            icon={<CreditCard className="w-3 h-3" />}
                                            file={backFile}
                                            uploadedUrl={backUrl}
                                            onFileChange={f => handleFileChange(f, 'back', setBackFile, setBackUrl)}
                                        />
                                        <FileUploadBox
                                            label="Ảnh selfie"
                                            icon={<Camera className="w-3 h-3" />}
                                            file={selfieFile}
                                            uploadedUrl={selfieUrl}
                                            onFileChange={f => handleFileChange(f, 'selfie', setSelfieFile, setSelfieUrl)}
                                        />
                                    </div>

                                    {uploading && (
                                        <div className="flex items-center gap-2 text-xs text-[#f0b90b]">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Đang tải ảnh lên...
                                        </div>
                                    )}

                                    {/* Disclaimer */}
                                    <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                                        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-400/80">
                                            Thông tin KYC của bạn được bảo mật và chỉ sử dụng cho mục đích xác minh danh tính.
                                            Hệ thống FYP demo — không lưu trữ dữ liệu cá nhân thật.
                                        </p>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !!uploading}
                                        className="w-full py-3.5 bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base shadow-lg shadow-yellow-500/20"
                                    >
                                        {submitting ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Đang gửi...</>
                                        ) : (
                                            <><Shield className="w-5 h-5" /> Gửi yêu cầu KYC</>
                                        )}
                                    </button>
                                </motion.div>
                            )}

                            {/* When approved — CTA to invest */}
                            {submission?.status === 'APPROVED' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                    <Link
                                        href="/assets"
                                        className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] font-bold rounded-xl border border-[#f0b90b]/20 hover:border-[#f0b90b]/40 transition-all text-sm"
                                    >
                                        Khám phá tài sản RWA →
                                    </Link>
                                </motion.div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
