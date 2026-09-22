"use strict";
/**
 * schemas.js — 24 sheets chuan Sheet 17iXM (map 1-1 tu Database.gs).
 * TAI_KHOAN: 8 cot spec.
 */
module.exports = {
  NHAN_VIEN_MOI: ["ID", "Ngày ĐK", "Họ tên", "Giới tính", "Năm sinh", "Trình độ", "Quê quán", "SĐT", "Ca đăng ký", "Chi nhánh ĐK", "Kinh nghiệm", "Xử lý đột xuất", "Facebook", "Nguồn biết tin", "Điểm AI", "Kết quả", "Trạng thái", "Mã nguồn", "Phiên bản", "Cập nhật lúc"],
  CHAM_CONG: ["MaNV", "Ngày", "CheckIn", "CheckOut", "GPS", "AnhDriveURL", "TrePhut", "Phat", "GhiChu"],
  NHAN_VIEN_TRAINING: ["ID", "Ma NV", "Ho ten", "SDT", "Khoa", "Chi nhanh", "Ca", "Ngay bat dau", "Ngay ket thuc", "So ngay Thu viec", "Trang thai", "Diem TEST", "Ket qua TEST", "Loai", "Nhom", "Phien ban", "Cap nhat luc", "Dong bo"],
  NHAN_VIEN_CHINH_THUC: ["ID", "Ma NV", "Ho ten", "SDT", "Khoa", "Chi nhanh", "Ca", "Ngay bat dau", "Trang thai", "Diem TEST", "Loai", "Ngay chinh thuc", "Phien ban", "Cap nhat luc", "Dong bo"],
  PHIEU_DOI_CA_TRAINING: ["ID", "Ma NV", "Ho ten", "Ngay", "Ca cu", "Ca moi", "Ly do", "Trang thai", "Ngay tao", "Het han", "Nguoi duyet"],
  LICH_LAM_VIEC: ["ID", "Ma NV", "Ho ten", "Chi nhanh", "Tuan bat dau", "Ngay", "Thu", "Ca", "Trang thai", "Nguoi thay", "Phien ban"],
  NHAN_VIEN_XUONG: ["ID", "Ma NV", "Ho ten", "SDT", "Chi nhanh", "Trang thai", "Dong bo"],
  NHAN_VIEN_VAN_PHONG: ["ID", "Ma NV", "Ho ten", "SDT", "Chi nhanh", "Trang thai", "Dong bo"],
  NHAN_VIEN_SALE: ["ID", "Ma NV", "Ho ten", "SDT", "Chi nhanh", "Trang thai", "Dong bo"],
  PHIEU_OFF_DOT_XUAT: ["ID", "Ma NV", "Ho ten", "Chi nhanh", "Ca", "Ngay OFF", "Ly do", "Nguoi thay", "Trang thai", "Buoc lien hoan", "Ngay tao"],
  PHIEU_OFF_HANG_TUAN: ["ID", "Ma NV", "Ho ten", "Chi nhanh", "Ca", "Ngay OFF", "Loai", "Trang thai", "Tu dong duyet", "Ngay tao"],
  RECORD_DIEM_DANH: ["ID", "Ma NV", "Ho ten", "Ngay", "Ca", "Chi nhanh", "Gio vao ca", "GPS vao", "Anh vao", "Drive vao", "Gio ra ca", "GPS ra", "Anh ra", "Drive ra", "Trang thai", "Vi pham", "Phien ban"],
  BAO_CAO_CHAM_CONG: ["Ma NV", "Ho ten", "Chi nhanh", "Thang", "Ngay tieu chuan", "Thuc te", "Tinh luong", "Gio TC", "Gio TT", "Gio TL", "Phep", "OT", "Tre", "Loi", "Trang thai"],
  KHOA_TEST: ["ID", "Ten khoa", "So cau", "Toi thieu/cau", "Ngay tao"],
  KET_QUA_TEST: ["ID", "Ma NV", "Ho ten", "Khoa", "Diem", "Dung/Tong", "Ket qua", "Thoi gian lam", "Ngay tao"],
  PHIEU_DOI_CA_OFFICIAL: ["ID", "Ma NV", "Ho ten", "Ngay", "Ca cu", "Ca moi", "NV thay ca", "Ly do", "Trang thai", "Ngay tao", "Nguoi duyet"],
  PHIEU_DOI_THIET_BI: ["ID", "Ma NV", "Ly do", "Thiet bi cu", "Thiet bi moi", "Trang thai", "Ngay tao", "Het han"],
  RECORD_ZALO: ["ID", "Thoi gian gui", "Nguoi nhan", "Loai", "Noi dung", "Trang thai", "Loi"],
  TAI_KHOAN: ["ID", "GMAIL", "HỌ & TÊN", "SĐT", "TRẠNG THÁI", "PHÂN QUYỀN", "MÃ PIN", "NGÀY TẠO"],
  AUDIT_LOG: ["ID", "Actor", "Action", "Entity", "Before", "After", "Timestamp", "IP"],
  SYNC_QUEUE: ["ID", "Entity", "Operation", "Version", "Updated At", "By", "Source", "Sync Status"],
  DRIVE_FILES: ["ID", "Ma NV", "Ho ten", "Ngay", "Loai", "File name", "Drive Path", "URL", "Created At"],
  LICH_PHONG_VAN: ["Ma ca", "Ho va ten", "So dien thoai", "Thoi gian hen", "Link Google Meet", "Trang thai xac nhan", "Diem AI", "Nhan xet AI", "Danh gia chung"],
  LICH_TEST_DAU_RA: ["Ma test", "Ho va ten", "So dien thoai", "Thoi gian hen", "Link Meet", "Diem cham /10", "Nhan xet chi tiet", "Xep loai"],
  // Bang ha tang rieng cua server (khong nam trong 24 sheet chuan)
  _APP_STATE: ["KEY", "VALUE", "UPDATED"],
};
