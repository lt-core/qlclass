export function renderHome() {
  document.getElementById('app').innerHTML = `
    <div class="home">
      <header class="home-top">
        <div class="brand"><i class="fa-solid fa-graduation-cap"></i> QLClass</div>
        <button class="btn" id="home-login"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</button>
      </header>

      <section class="home-hero">
        <h1>Quản lý lớp học<br><span>mỗi người một vai trò</span></h1>
        <p>
          Hệ thống quản lý lớp dành cho giáo viên chủ nhiệm và ban cán sự lớp:
          theo dõi thành tích — vi phạm theo tuần, sơ đồ chỗ ngồi kéo-thả,
          thủ quỹ, đời sống và thông báo lớp học. Không cần cài đặt, mở trình duyệt là dùng.
        </p>
        <div class="home-cta">
          <button class="btn lg-btn" id="home-login2"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay</button>
        </div>
        <div class="home-badges">
          <span><i class="fa-solid fa-user-shield"></i> 3 cấp vai trò</span>
          <span><i class="fa-solid fa-certificate"></i> Chức vụ phân quyền</span>
          <span><i class="fa-solid fa-cloud-arrow-up"></i> Lưu trữ tự động</span>
        </div>
      </section>

      <section class="home-feats">
        <h2>Tính năng của App</h2>
        <div class="feat-grid">
          <div class="feat-card"><i class="fa-solid fa-scale-balanced"></i>
            <b>Thành tích & vi phạm</b>
            <p>Tổ trưởng gửi ghi nhận hằng tuần, giáo viên duyệt rồi mới tính điểm. Điểm mặc định mỗi tuần cho học sinh và cả lớp.</p></div>
          <div class="feat-card"><i class="fa-solid fa-school"></i>
            <b>Sơ đồ chỗ ngồi</b>
            <p>Kéo-thả xếp chỗ trực quan hoặc chọn học sinh rồi bấm vào chỗ trống. Hỗ trợ nhiều tổ với kích thước tùy chỉnh.</p></div>
          <div class="feat-card"><i class="fa-solid fa-id-badge"></i>
            <b>Phân quyền chức vụ</b>
            <p>Lớp trưởng, tổ trưởng, thủ quỹ, bí thư... mỗi chức vụ một khu vực riêng, giáo viên phê duyệt toàn bộ.</p></div>
          <div class="feat-card"><i class="fa-solid fa-coins"></i>
            <b>Thủ quỹ lớp</b>
            <p>Ghi thu - chi kèm ngày và mô tả, tổng quỹ tự động cân đối, ai được phép ghi nhận do lớp quyết định.</p></div>
          <div class="feat-card"><i class="fa-solid fa-heart"></i>
            <b>Đời sống lớp</b>
            <p>Theo dõi lịch trực vệ sinh và các hoạt động văn thể - thể thao của từng thành viên trong tổ.</p></div>
          <div class="feat-card"><i class="fa-solid fa-bullhorn"></i>
            <b>Thông báo lớp học</b>
            <p>Soạn thông báo có định dạng (markdown), chọn người nhận: cả lớp hay riêng học sinh/giáo viên, hẹn giờ hết hạn.</p></div>
        </div>
      </section>

      <footer class="home-foot">
        <i class="fa-solid fa-graduation-cap"></i> QLClass — phần mềm quản lý lớp học
      </footer>
    </div>`;

  const goLogin = () => import('./login.js').then(m => m.renderLogin());
  document.getElementById('home-login').onclick = goLogin;
  document.getElementById('home-login2').onclick = goLogin;
}
