/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import classNames from "classnames/bind";
import { MdLogout } from "react-icons/md";
import { Link } from "react-router-dom";
import { RiMenuFold2Fill, RiMenuFoldFill } from "react-icons/ri";

// import LogoVems from "@/assets/images/Layout/Navbar/logo-login.png";
import AvatarDefault from "@/assets/img/defaultAvatar.jpg";
import NoAvatarImage from "@/assets/img/defaultAvatar.jpg";
import styles from "./Sidebar.module.scss";
import VemsImage from "@/components/VemsImage";
import React, { useEffect, useState } from "react";
import { getSidebarItemsByRole, type SiderItem } from "@/hooks/useGetMenuItem";
import { checkActiveLink } from "@/utils/validate";
import { configRoutes } from "@/constants/route";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuthStore } from "@/hooks/UseAuth";
import { motion } from "framer-motion";
// import { SiderItem } from "@/constants/SiderController/type";
// import getListSlider from "@/constants/SiderController";
// import { configRoutes } from "@/constants/routes";
// import { useGetInfo } from "@/hooks/info/useGetInfo";
// import { checkActiveLink } from "@/utils/regex";

const cx = classNames.bind(styles);

type SidebarSystemProps = {
  isToggleNavbar: boolean;
  setIsToggleNavbar: any;
};

const SidebarSystem = ({
  isToggleNavbar,
  setIsToggleNavbar,
}: SidebarSystemProps) => {
  const { auth, logout } = useAuthStore();
  // const userInfo = allInfo ? allInfo() : null;
  const sidebarItems = getSidebarItemsByRole(auth.roles ?? "") ?? [];

  const pathName = window.location.pathname;
  // const navigate = useNavigate();

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // ❌❌ Responsive Only ❌❌//
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // const items = Array.from({ length: 3 }).map((_, index) => ({
  //   key: String(index + 1),
  //   label: `nav ${index + 1}`,
  // }));

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  return (
    <>
      <nav className={cx("navbar", `${isToggleNavbar ? "toggle" : ""}`)}>
        {/* Logo Start */}
        <div className={cx("navbar-logo")}>
          <div className={cx("navbar-item-inner-logo")}>
            <h2 className={cx("logo-text")}>GENSPA</h2>
          </div>

          {isMobile && (
            <>
              <div
                className={cx("icon-menu-wrapper")}
                onClick={() => {
                  setIsToggleNavbar(false);
                }}
              >
                <RiMenuFoldFill size={26} className={cx("icon-menu")} />
              </div>
            </>
          )}

          {!isMobile && (
            <>
              {isToggleNavbar ? (
                <div
                  className={cx("icon-menu-wrapper")}
                  onClick={() => {
                    setIsToggleNavbar(false);
                  }}
                >
                  <RiMenuFoldFill size={26} className={cx("icon-menu")} />
                </div>
              ) : (
                <div
                  className={cx("icon-menu-wrapper")}
                  onClick={() => {
                    setIsToggleNavbar(true);
                  }}
                >
                  <RiMenuFold2Fill size={26} className={cx("icon-menu")} />
                </div>
              )}
            </>
          )}
        </div>

        <ul className={cx("navbar-items")}>
          {sidebarItems
            // .filter((item) => {
            //   if (item.link === configRoutes.spaChatBot) {
            //     return auth.levelMembership === "ELITE";
            //   }
            //   return true;
            // })
            .map((sidebarItem: SiderItem, index: number) => (
              <motion.li
                key={index}
                className={cx(
                  "navbar-item",
                  checkActiveLink(sidebarItem.activeLink, pathName)
                    ? "active"
                    : ""
                )}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.04,
                  type: "spring",
                  stiffness: 180,
                  damping: 12,
                }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  className={cx("navbar-item-inner")}
                  to={`${sidebarItem.link}`}
                >
                  <div className={cx("navbar-item-inner-icon-wrapper")}>
                    {React.isValidElement(sidebarItem?.icon) &&
                      React.cloneElement(
                        sidebarItem.icon as React.ReactElement<any>,
                        {
                          className: cx("navbar-item-inner-icon"),
                        }
                      )}
                  </div>
                  <div className={cx("link-text-wrapper")}>
                    <span className={cx("link-text")}>{sidebarItem?.name}</span>
                  </div>
                </Link>
              </motion.li>
            ))}
        </ul>

        {/* Profile Start */}
        <div className={cx("profile-wrapper")}>
          <div className={cx("profile-item")}>
            {/* Profile */}
            <Link
              className={cx("profile-item-inner")}
              to=""
              // to={isSpaComp ? configRoutes.spaProfile : ""}
            >
              <div className={cx("profile-item-inner-icon-wrapper")}>
                <div className={cx("avatar-wrapper")}>
                  <VemsImage
                    src={auth.image ?? AvatarDefault}
                    alt={"avatar"}
                    className={cx("user-avatar")}
                    fallback={NoAvatarImage}
                  />
                </div>
              </div>
              <div className={cx("link-text-wrapper")}>
                <span className={cx("link-text")}>Hồ sơ</span>
              </div>
            </Link>
          </div>

          <div className={cx("profile-item", "log-out-wrapper")}>
            {/* Log out */}
            <div
              className={cx("profile-item-inner")}
              onClick={() => setConfirmOpen(true)}
            >
              <div className={cx("profile-item-inner-icon-wrapper")}>
                <MdLogout className={cx("profile-item-inner-icon")} />
              </div>
              <div className={cx("link-text-wrapper")}>
                <span className={cx("link-text")}>Đăng xuất</span>
              </div>
            </div>
          </div>
        </div>
        {/* Profile End */}
      </nav>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => logout()}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?"
        type="warning"
      />
    </>
  );
};

export default SidebarSystem;
