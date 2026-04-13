const fs = require('fs');
let src = fs.readFileSync('src/components/MessageList.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Add 'failed' to the status tick row (between the existing ternary chain)
const oldStatusRow = `                                  {message.status === 'sending' ? (
                                   <Clock className="w-3 h-3 text-white/30 animate-pulse" />
                                  ) : message.status === 'sent' ? (
                                   <Check className="w-3.5 h-3.5 text-white/40" />
                                  ) : message.status === 'delivered' ? (
                                   <CheckCheck className="w-4 h-4 text-white/50" />
                                  ) : (
                                   <CheckCheck className="w-4 h-4 text-[#3b82f6]" />
                                  )}`;

const newStatusRow = `                                  {message.status === 'failed' ? (
                                   <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                  ) : message.status === 'sending' ? (
                                   <Clock className="w-3 h-3 text-white/30 animate-pulse" />
                                  ) : message.status === 'sent' ? (
                                   <Check className="w-3.5 h-3.5 text-white/40" />
                                  ) : message.status === 'delivered' ? (
                                   <CheckCheck className="w-4 h-4 text-white/50" />
                                  ) : (
                                   <CheckCheck className="w-4 h-4 text-[#3b82f6]" />
                                  )}`;

// 2. Add upload error label above status footer
const oldContentFooter = `                        {/* Content & Footer */}
                        <div className="flex flex-col relative min-w-0">
                          {message.is_deleted_everyone ? (`;

const newContentFooter = `                        {/* Content & Footer */}
                        <div className="flex flex-col relative min-w-0">
                          {message.status === 'failed' && message.uploadError && (
                            <p className="text-red-400 text-[11px] px-1 pb-1 flex items-center gap-1.5">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              {message.uploadError}
                            </p>
                          )}
                          {message.is_deleted_everyone ? (`;

// 3. Add AlertCircle to the import if not present
const hasAlertCircle = src.includes('AlertCircle');

let result = src;

const c1 = result.split(oldStatusRow).length - 1;
const c2 = result.split(oldContentFooter).length - 1;
console.log('Status row found:', c1, 'times');
console.log('Footer found:', c2, 'times');

if (c1 > 0) result = result.split(oldStatusRow).join(newStatusRow);
if (c2 > 0) result = result.split(oldContentFooter).join(newContentFooter);

// Add AlertCircle to import if missing
if (!hasAlertCircle) {
  result = result.replace(
    "import { Check, CheckCheck, FileText, PlayCircle, Reply, Forward, ChevronDown, X, Clock, Loader2, Download, ChevronLeft, ChevronRight }",
    "import { Check, CheckCheck, FileText, PlayCircle, Reply, Forward, ChevronDown, X, Clock, Loader2, Download, ChevronLeft, ChevronRight, AlertCircle }"
  );
  console.log('Added AlertCircle to imports');
}

fs.writeFileSync('src/components/MessageList.tsx', result.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done - failed state UI added');
