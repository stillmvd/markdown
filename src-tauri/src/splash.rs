use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct Splash(Arc<AtomicBool>);

impl Splash {
    pub fn close(&self) {
        self.0.store(true, Ordering::Relaxed);
    }
}

pub fn show(identifier: &str) -> Option<Splash> {
    if imp::already_running(identifier) {
        return None;
    }
    let closing = Arc::new(AtomicBool::new(false));
    let flag = closing.clone();
    std::thread::spawn(move || imp::run(&flag));
    Some(Splash(closing))
}

#[cfg(windows)]
mod imp {
    use std::mem::{size_of, zeroed};
    use std::ptr::{null, null_mut};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::{Duration, Instant};

    use windows_sys::Win32::Foundation::{POINT, SIZE};
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetMonitorInfoW,
        MonitorFromPoint, SelectObject, AC_SRC_ALPHA, AC_SRC_OVER, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, BLENDFUNCTION, DIB_RGB_COLORS, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::HiDpi::{
        GetDpiForMonitor, SetThreadDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
        MDT_EFFECTIVE_DPI,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, FindWindowW,
        PeekMessageW, RegisterClassW, ShowWindow, TranslateMessage, UpdateLayeredWindow, MSG,
        PM_REMOVE, SW_SHOWNOACTIVATE, ULW_ALPHA, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
    };

    const FRAMES: [(f64, &[u8]); 4] = [
        (1.0, include_bytes!("../icons/splash-100.bgra")),
        (1.25, include_bytes!("../icons/splash-125.bgra")),
        (1.5, include_bytes!("../icons/splash-150.bgra")),
        (2.0, include_bytes!("../icons/splash-200.bgra")),
    ];
    const FADE_IN: f64 = 0.35;
    const PULSE: f64 = 1.4;
    const FADE_OUT: f64 = 0.22;
    const MIN_SHOWN: f64 = 0.5;
    const TIMEOUT: f64 = 8.0;

    fn alpha_at(t: f64) -> f64 {
        if t < FADE_IN {
            1.0 - (1.0 - t / FADE_IN).powi(3)
        } else {
            0.86 + 0.14 * (std::f64::consts::TAU * (t - FADE_IN) / PULSE).cos()
        }
    }

    fn blend(alpha: f64) -> BLENDFUNCTION {
        BLENDFUNCTION {
            BlendOp: AC_SRC_OVER as u8,
            BlendFlags: 0,
            SourceConstantAlpha: (alpha.clamp(0.0, 1.0) * 255.0).round() as u8,
            AlphaFormat: AC_SRC_ALPHA as u8,
        }
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(Some(0)).collect()
    }

    pub fn already_running(identifier: &str) -> bool {
        let class = wide(&format!("{identifier}-sic"));
        unsafe { !FindWindowW(class.as_ptr(), null()).is_null() }
    }

    unsafe fn primary_monitor() -> ((i32, i32), f64) {
        SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let monitor = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
        let mut info: MONITORINFO = zeroed();
        info.cbSize = size_of::<MONITORINFO>() as u32;
        GetMonitorInfoW(monitor, &mut info);
        let (mut dpi, mut dpi_y) = (96, 96);
        GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi, &mut dpi_y);
        let work = info.rcWork;
        (
            ((work.left + work.right) / 2, (work.top + work.bottom) / 2),
            dpi as f64 / 96.0,
        )
    }

    pub fn run(closing: &AtomicBool) {
        let (center, scale) = unsafe { primary_monitor() };
        let (_, data) = FRAMES
            .iter()
            .min_by(|a, b| (a.0 - scale).abs().total_cmp(&(b.0 - scale).abs()))
            .unwrap();
        let width = u32::from_le_bytes(data[0..4].try_into().unwrap()) as i32;
        let height = u32::from_le_bytes(data[4..8].try_into().unwrap()) as i32;
        let pixels = &data[8..];
        let position = POINT {
            x: center.0 - width / 2,
            y: center.1 - height / 2,
        };

        unsafe {
            let instance = GetModuleHandleW(null());
            let class = wide("MarkdownSplash");
            let wc = WNDCLASSW {
                lpfnWndProc: Some(DefWindowProcW),
                hInstance: instance,
                lpszClassName: class.as_ptr(),
                ..zeroed()
            };
            RegisterClassW(&wc);
            let hwnd = CreateWindowExW(
                WS_EX_LAYERED
                    | WS_EX_TOOLWINDOW
                    | WS_EX_TOPMOST
                    | WS_EX_NOACTIVATE
                    | WS_EX_TRANSPARENT,
                class.as_ptr(),
                null(),
                WS_POPUP,
                position.x,
                position.y,
                width,
                height,
                null_mut(),
                null_mut(),
                instance,
                null(),
            );
            if hwnd.is_null() {
                return;
            }

            let dc = CreateCompatibleDC(null_mut());
            let mut info: BITMAPINFO = zeroed();
            info.bmiHeader = BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                ..zeroed()
            };
            let mut bits = null_mut();
            let bitmap = CreateDIBSection(dc, &info, DIB_RGB_COLORS, &mut bits, null_mut(), 0);
            std::ptr::copy_nonoverlapping(pixels.as_ptr(), bits as *mut u8, pixels.len());
            let previous = SelectObject(dc, bitmap);

            let size = SIZE {
                cx: width,
                cy: height,
            };
            let origin = POINT { x: 0, y: 0 };
            UpdateLayeredWindow(
                hwnd,
                null_mut(),
                &position,
                &size,
                dc,
                &origin,
                0,
                &blend(0.0),
                ULW_ALPHA,
            );
            ShowWindow(hwnd, SW_SHOWNOACTIVATE);

            let start = Instant::now();
            let mut fade: Option<(f64, f64)> = None;
            loop {
                let mut msg: MSG = zeroed();
                while PeekMessageW(&mut msg, null_mut(), 0, 0, PM_REMOVE) != 0 {
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
                let t = start.elapsed().as_secs_f64();
                if fade.is_none()
                    && ((closing.load(Ordering::Relaxed) && t >= MIN_SHOWN) || t >= TIMEOUT)
                {
                    fade = Some((t, alpha_at(t)));
                }
                let alpha = match fade {
                    Some((from, alpha)) => {
                        let k = (t - from) / FADE_OUT;
                        if k >= 1.0 {
                            break;
                        }
                        alpha * (1.0 - k * k * (3.0 - 2.0 * k))
                    }
                    None => alpha_at(t),
                };
                UpdateLayeredWindow(
                    hwnd,
                    null_mut(),
                    null(),
                    null(),
                    null_mut(),
                    null(),
                    0,
                    &blend(alpha),
                    ULW_ALPHA,
                );
                std::thread::sleep(Duration::from_millis(15));
            }

            DestroyWindow(hwnd);
            SelectObject(dc, previous);
            DeleteObject(bitmap);
            DeleteDC(dc);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn already_running(_identifier: &str) -> bool {
        true
    }

    pub fn run(_closing: &std::sync::atomic::AtomicBool) {}
}
