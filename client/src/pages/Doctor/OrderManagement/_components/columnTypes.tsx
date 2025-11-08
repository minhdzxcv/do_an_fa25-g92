/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button, Dropdown, Space, Tag, type MenuProps } from "antd";
import {
  EllipsisOutlined,
  EditOutlined,
  // DeleteOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { AppointmentTableProps } from "./type";
import dayjs from "dayjs";
import AvatarTable from "@/components/AvatarTable";
import NoAvatarImage from "@/assets/img/defaultAvatar.jpg";
import { statusTagColor, translateStatus } from "@/utils/format";
import { appointmentStatusEnum } from "@/common/types/auth";

export const AppointmentColumn = (): ColumnsType<AppointmentTableProps> => [
  {
    title: "STT",
    dataIndex: "index",
    width: 70,
    align: "center",
    render: (_, __, index) => <span>{index + 1}</span>,
  },
  // {
  //   title: "Mã cuộc hẹn",
  //   dataIndex: "id",
  //   ellipsis: true,
  //   width: 240,
  // },
  {
    title: "Khách hàng",
    dataIndex: "full_name",
    render: (_, record) => (
      <Space size={12}>
        <AvatarTable
          src={record.customer.avatar ?? NoAvatarImage}
          alt="avatar"
          fallback={NoAvatarImage}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {record.customer.full_name}
          </div>
          <div style={{ color: "#8c8c8c", fontSize: 12 }}>
            {record.customer.email}
          </div>
        </div>
      </Space>
    ),
  },
  {
    title: "Dịch vụ",
    dataIndex: "services",
    render: (_, record) => {
      const { details } = record;

      return (
        <Space size={[4, 4]} wrap>
          {details.map((service) => (
            <Tag color="blue" key={service.id}>
              {service.service.name}
            </Tag>
          ))}
        </Space>
      );
    },
  },
  {
    title: "Ngày hẹn",
    dataIndex: "appointment_date",
    align: "center",
    width: 150,
    render: (value) => dayjs(value).format("DD/MM/YYYY"),
    sorter: (a, b) =>
      dayjs(a.appointment_date).unix() - dayjs(b.appointment_date).unix(),
  },
  {
    title: "Thời gian",
    align: "center",
    sorter: (a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix(),
    render: (_, record) => (
      <Tag color="blue">
        {dayjs(record.startTime).format("HH:mm")} -{" "}
        {dayjs(record.endTime).format("HH:mm")}
      </Tag>
    ),
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    align: "center",
    width: 130,
    render: (_, record) => {
      return (
        <Tag color={statusTagColor(record.status)}>
          {translateStatus(record.status)}
        </Tag>
      );
    },
  },
  {
    title: "",
    dataIndex: "operation",
    key: "operation",
    fixed: "right",
    align: "right",
    width: 80,
    render: (_, record) => {
      const renderItems = (
        record: AppointmentTableProps,
        onComplete: () => void,
        onUpdate: () => void
      ): MenuProps["items"] => {
        const items: MenuProps["items"] = [];

        if (record.status === appointmentStatusEnum.Deposited) {
          items.push({
            key: "0",
            label: (
              <a onClick={onUpdate}>
                <Space>
                  <EditOutlined /> Cập nhật lịch hẹn
                </Space>
              </a>
            ),
          });
        }

        if (record.status === appointmentStatusEnum.Deposited) {
          items.push({
            key: "1",
            label: (
              <a onClick={onComplete}>
                <Space>
                  <CheckOutlined /> Cập nhật thành hoàn thành
                </Space>
              </a>
            ),
          });
        }

        // Nếu cần thêm hành động xoá:
        // items.push({
        //   key: "2",
        //   label: (
        //     <div onClick={onRemove}>
        //       <Space>
        //         <DeleteOutlined /> Xóa
        //       </Space>
        //     </div>
        //   ),
        // });

        return items;
      };

      return (
        <Dropdown
          menu={{
            items: renderItems(record, record.onComplete!, record.onUpdate!),
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<EllipsisOutlined style={{ fontSize: 18 }} />}
            disabled={
              !(
                (record.status === appointmentStatusEnum.Deposited)
                // || record.onRemove
              )
            }
          />
        </Dropdown>
      );
    },
  },
];
