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
      // 1. Save to Database
      const { error: dbError } = await supabase
        .from('reports')
        .insert({
          reporter_id: user?.id,
          reported_id: reportedUserId,
          reason,
          description
        })

      if (dbError) throw dbError

      // 2. Send Automated Email (with safety timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

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
        // Silently continue if email fails - we already saved to DB
        console.warn('Automated email notification delayed or failed:', emailErr);
      }

      // 3. Success state
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
     const body = encodeURIComponent(`
Report Summary:
----------------
Reason: ${reason}
Description: ${description}

Details:
Reported User ID: ${reportedUserId}
Reporter ID: ${user?.id}
Timestamp: ${new Date().toISOString()}
     `)
     window.location.href = `mailto:adithyanas2694@gmail.com?subject=${subject}&body=${body}`
  }

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-[#111b21] w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
           <div className="w-16 h-16 bg-[#00a884]/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#00a884]" />
           </div>
           <h2 className="text-[#e9edef] text-xl font-bold mb-2">Admin Notified</h2>
           <p className="text-[#8696a0] text-sm mb-8">
             Your report against **{reportedUserName}** has been sent to the administrator. We will review the evidence and take action.
           </p>
           <div className="flex flex-col gap-3 w-full">
               <div className="w-full flex items-center justify-center gap-2 py-3 bg-[#00a884]/20 text-[#00a884] font-bold rounded-xl border border-[#00a884]/30">
                 <CheckCircle2 className="w-4 h-4" />
                 Report Sent Automatically
               </div>
               <button 
                onClick={handleCopyEmail}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] font-bold rounded-xl border border-[#2a3942] transition-all"
               >
                 {copied ? (
                    <>
                       <CheckCircle2 className="w-4 h-4 text-[#00a884]" />
                       Email Copied!
                    </>
                 ) : (
                    <>
                       <Mail className="w-4 h-4 text-[#8696a0]" />
                       Copy Admin Email (Backup)
                    </>
                 )}
               </button>
               <button 
                onClick={onClose}
                className="w-full py-3 text-[#8696a0] hover:text-[#e9edef] font-medium"
               >
                 Done
               </button>
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl border border-[#2a3942] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a3942] bg-[#202c33]">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ea0038]/10 rounded-lg">
                 <AlertCircle className="w-5 h-5 text-[#ea0038]" />
              </div>
              <h2 className="text-[#e9edef] font-bold">Report User</h2>
           </div>
           <button onClick={onClose} className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] transition-colors">
             <X className="w-6 h-6"/>
           </button>
        </div>

        {/* Form Body */}
        <div className="p-6 flex flex-col gap-6">
           <div className="space-y-4">
              <p className="text-sm text-[#8696a0]">
                You are reporting **{reportedUserName}**. This report will be sent to the administrator for review.
              </p>

              {/* Reason Dropdown */}
              <div className="space-y-2">
                 <label className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">Reason for report</label>
                 <div className="relative">
                    <select 
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-[#202c33] border border-[#2a3942] rounded-xl px-4 py-3 text-[#e9edef] text-sm appearance-none focus:outline-none focus:border-[#00a884] cursor-pointer"
                    >
                       <option value="" disabled>Select a reason...</option>
                       {REPORT_REASONS.map(r => (
                          <option key={r.id} value={r.label}>{r.label}</option>
                       ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0] pointer-events-none" />
                 </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                 <label className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">Details</label>
                 <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide more details about the behavior..."
                    className="w-full h-32 bg-[#202c33] border border-[#2a3942] rounded-xl px-4 py-3 text-[#e9edef] text-sm focus:outline-none focus:border-[#00a884] resize-none"
                 />
              </div>

              {error && (
                 <div className="p-3 bg-[#ea0038]/10 border border-[#ea0038]/20 rounded-lg flex items-center gap-2 text-[#ea0038] text-xs font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                 </div>
              )}
           </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#2a3942] bg-[#202c33] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm text-[#8696a0] font-medium hover:text-[#e9edef] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-2.5 bg-[#ea0038] hover:bg-[#c4002f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#ea0038]/20"
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
