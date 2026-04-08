'use client'

import { useState } from 'react'
import { X, Send, AlertCircle, CheckCircle2, ChevronDown, Mail } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

const supabase = createClient()

interface ReportModalProps {
  reportedUserId: string
  reportedUserName: string
  onClose: () => void
}

const REPORT_REASONS = [
  { id: 'sexual', label: 'Sexual Content / Inappropriate' },
  { id: 'unprofessional', label: 'Unofficial / Unprofessional Behavior' },
  { id: 'harassment', label: 'Harassment / Bullying' },
  { id: 'spam', label: 'Spam / Scams' },
  { id: 'other', label: 'Other Issue' }
]

export default function ReportModal({ reportedUserId, reportedUserName, onClose }: ReportModalProps) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason for the report.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const { error: dbError } = await supabase
        .from('reports')
        .insert({ reporter_id: user?.id, reported_id: reportedUserId, reason, description })
      if (dbError) throw dbError

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            reporterName: user?.user_metadata?.full_name || user?.email,
            reporterEmail: user?.email,
            reportedName: reportedUserName,
            reason,
            description
          })
        });
        clearTimeout(timeoutId);
      } catch (emailErr) {
        console.warn('Email notification delayed:', emailErr);
      }
      setIsSuccess(true)
    } catch (err: any) {
      console.error('Report submission error:', err)
      setError('Failed to submit report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('adithyanas2694@gmail.com')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEmailDirect = () => {
     const subject = encodeURIComponent(`URGENT: Report for User ${reportedUserName}`)
     const body = encodeURIComponent(`\nReport Summary:\n----------------\nReason: ${reason}\nDescription: ${description}\n\nDetails:\nReported User ID: ${reportedUserId}\nReporter ID: ${user?.id}\nTimestamp: ${new Date().toISOString()}\n`)
     window.location.href = `mailto:adithyanas2694@gmail.com?subject=${subject}&body=${body}`
  }

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-[#0a0a0a] w-full max-w-sm rounded-2xl shadow-2xl border border-white/[0.06] p-8 flex flex-col items-center text-center">
           <div className="w-14 h-14 bg-white/[0.06] rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-white" />
           </div>
           <h2 className="text-white text-lg font-bold mb-2">Admin Notified</h2>
           <p className="text-zinc-500 text-sm mb-8">
             Your report against <strong className="text-white">{reportedUserName}</strong> has been sent for review.
           </p>
           <div className="flex flex-col gap-3 w-full">
               <div className="w-full flex items-center justify-center gap-2 py-3 bg-white/[0.04] text-zinc-400 font-bold rounded-xl border border-white/[0.06] text-sm">
                 <CheckCircle2 className="w-4 h-4" />
                 Report Sent
               </div>
               <button 
                onClick={handleCopyEmail}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white/[0.04] hover:bg-white/[0.06] text-white font-bold rounded-xl border border-white/[0.06] transition-all text-sm"
               >
                 {copied ? (
                    <>
                       <CheckCircle2 className="w-4 h-4 text-white" />
                       Email Copied!
                    </>
                 ) : (
                    <>
                       <Mail className="w-4 h-4 text-zinc-500" />
                       Copy Admin Email
                    </>
                 )}
               </button>
               <button 
                onClick={onClose}
                className="w-full py-3 text-zinc-500 hover:text-white font-medium text-sm"
               >
                 Done
               </button>
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-[#0a0a0a] w-full max-w-md rounded-2xl shadow-2xl border border-white/[0.06] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                 <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-white font-bold">Report User</h2>
           </div>
           <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded-full text-zinc-500 transition-colors">
             <X className="w-5 h-5"/>
           </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
           <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Reporting <strong className="text-white">{reportedUserName}</strong>. This will be sent to the administrator.
              </p>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Reason</label>
                 <div className="relative">
                    <select 
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm appearance-none focus:outline-none focus:border-white/20 cursor-pointer"
                    >
                       <option value="" disabled>Select a reason...</option>
                       {REPORT_REASONS.map(r => (
                          <option key={r.id} value={r.label}>{r.label}</option>
                       ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Details</label>
                 <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide more details..."
                    className="w-full h-32 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 resize-none placeholder-zinc-700"
                 />
              </div>

              {error && (
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-xs font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                 </div>
              )}
           </div>
        </div>

        <div className="p-5 border-t border-white/[0.04] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm text-zinc-500 font-medium hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                 <Send className="w-3.5 h-3.5" />
                 Submit Report
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
