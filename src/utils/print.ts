/**
 * Ultra-robust browser printing helper designed to bypass PWA standalone pop-up blocker limits
 * and Safari window restrictions. Uses a temporary hidden iframe instead of window.open()
 */
export function printHtml(htmlContent: string) {
    // 1. Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
        alert('Printing not supported in this browser environment');
        return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // 2. Wait for rendering, trigger browser print view, and cleanup
    setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Remove iframe after print dialog is closed or after a delay
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 2000);
    }, 500);
}
