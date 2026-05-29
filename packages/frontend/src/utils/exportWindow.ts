export interface ExportWindowHandle {
  redirect: (url: string) => void;
  close: () => void;
}

export function openExportWindow(): ExportWindowHandle {
  const popup = window.open('', '_blank');

  if (popup) {
    popup.document.title = '正在准备完整视频';
    popup.document.body.innerHTML = '<p style="font-family: sans-serif;">正在准备完整视频，请稍候...</p>';
  }

  return {
    redirect(url: string) {
      if (popup && !popup.closed) {
        popup.location.href = url;
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    close() {
      if (popup && !popup.closed) {
        popup.close();
      }
    },
  };
}
