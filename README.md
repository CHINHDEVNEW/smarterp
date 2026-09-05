# SmartERP

Ứng dụng quản lý bán hàng dạng PWA dùng React, Vite và Supabase.

## Chạy trên máy

1. Sao chép `.env.example` thành `.env.local` và điền Project URL cùng Publishable Key của Supabase.
2. Cài thư viện và chạy ứng dụng:

```bash
npm install
npm run dev
```

## Database

Chạy các migration trong `supabase/migrations` theo thứ tự tên file. Không đưa `service_role` hoặc database password vào frontend.

Các migration bổ sung cần có trên môi trường hiện tại:

- `20260906_core_hardening.sql`: giao dịch nguyên tử, trả hàng, hủy chứng từ và phân quyền RPC.
- `20260906_finance_permissions.sql`: sổ thu chi và tài khoản tiền an toàn.
- `20260906_product_images.sql`: kho ảnh sản phẩm tối đa 5 MB.
- `20260906_product_code_default.sql`: tự sinh mã khi tạo sản phẩm mà không nhập mã.
- `20260906_catalog_settings_permissions.sql`: khóa quyền ghi danh mục và cài đặt theo vai trò.

## Kiểm tra bản phát hành

```bash
npm run lint
npm test
npm run build
npm run preview
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Biến môi trường: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `public/_redirects` đã cấu hình fallback cho React Router.

Sau khi có URL `pages.dev`, thêm URL đó vào Supabase Authentication → URL Configuration → Redirect URLs để luồng quên mật khẩu hoạt động trên production.

## Edge Functions

Triển khai chức năng quản lý thành viên:

```bash
supabase functions deploy manage-members --project-ref YOUR_PROJECT_REF --use-api
```

Thêm cả `http://localhost:5173/reset-password` và URL production `/reset-password` vào danh sách Redirect URLs của Supabase Auth để liên kết mời và quên mật khẩu mở đúng màn hình tạo mật khẩu.

Không bật hàng đợi ghi dữ liệu khi offline cho đơn hàng, thanh toán hoặc tồn kho. Ứng dụng chỉ dùng dữ liệu đã lưu gần nhất để tra cứu lúc mất mạng nhằm tránh trùng giao dịch.
