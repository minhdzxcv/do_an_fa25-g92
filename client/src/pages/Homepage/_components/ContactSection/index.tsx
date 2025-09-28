import styles from "./ContactSection.module.scss";
import classNames from "classnames/bind";

const cx = classNames.bind(styles);

const ContactSection = () => {
  return (
    <section className={cx("contactSection")}>
      <div className="container">
        <div className={cx("headingWrapper")}>
          <h2 className={cx("heading")}>Liên Hệ Với Chúng Tôi</h2>
          <p className={cx("subHeading")}>
            Hãy để lại thông tin, chúng tôi sẽ phản hồi sớm nhất có thể.
          </p>
        </div>

        <div className={cx("content")}>
          <div className={cx("info")}>
            <div className={cx("infoItem")}>
              <i className="fas fa-map-marker-alt"></i>
              <span>123 Đường ABC, Quận Cầu Giấy , TP. Hà Nội</span>
            </div>
            <div className={cx("infoItem")}>
              <i className="fas fa-phone-alt"></i>
              <span>+84 123 456 789</span>
            </div>
            <div className={cx("infoItem")}>
              <i className="fas fa-envelope"></i>
              <span>contact@spaxinh.vn</span>
            </div>

            <iframe
              className={cx("map")}
              title="Google Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d59584.985396622506!2d105.74947354586162!3d21.03022160422528!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ab5756f91033%3A0x576917442d674bfd!2zQ-G6p3UgR2nhuqV5LCBIw6AgTuG7mWksIFZp4buHdCBOYW0!5e0!3m2!1svi!2s!4v1759068655523!5m2!1svi!2s"
              allowFullScreen
              loading="lazy"
            ></iframe>
          </div>

          <form className={cx("form")}>
            <input type="text" placeholder="Họ và tên" required />
            <input type="email" placeholder="Email" required />
            <input type="text" placeholder="Số điện thoại" required />
            <textarea placeholder="Nội dung" rows={4} required></textarea>
            <button type="submit" className={cx("btnSubmit")}>
              Gửi Ngay
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
