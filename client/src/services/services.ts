import { axiosBaseQuery } from "@/libs/axios/axiosBase";
import { createApi } from "@reduxjs/toolkit/query/react";

const baseUrl = import.meta.env.VITE_PUBLIC_API || "";

export type CategoryData = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategory = {
  name: string;
  description?: string;
};

export type ServiceData = {
  id: string;
  name: string;
  price: number;
  images:
    | {
        url: string;
      }[]
    | [];
  description: string;
  categoryId: string;
  categoryName: string;
  spaId: string;
  spaName: string;
  isActive: boolean;
  spaAddress: string | null;
};

export type CreateService = {
  name: string;
  price: number;
  description?: string;
  categoryId: string;
  spaId: string;
  isActive?: boolean;
};

export type CreateAppointment = {
  customerId: string;
  spaId: string;
  serviceId: string;
  appointmentTime: string;
  status: string;
  note: string;
};

export type AppointmentData = {
  id: string;
  appointmentTime: string;
  status: string;
  note: string;
  customerId: string;
  staffId: string | null;
  spaId: string;
  createdAt: string;
  updatedAt: string;
  serviceId: string;
  specialistId: string | null;
  customerName: string | null;
  staffName: string | null;
  spaName: string | null;
  serviceName: string | null;
  specialistName: string | null;
  isDone: boolean;
};

export type UpdateAppointment = {
  customerId: string;
  spaId: string;
  serviceId: string;
  staffId: string | null;
  specialistId: string | null;
  appointmentTime: string;
  status: string;
  note?: string;
};

export type UpdateCompletedAppointment = {
  services: {
    serviceId: string;
    quantity: number;
    note: string | null;
  }[];
};

export type InvoiceData = {
  id: string;
  totalAmount: number;
  note: string | null;
  customerId: string;
  spaId: string;
  createdAt: string;
  updatedAt: string;
  appointmentId: string;
  voucherId: string | null;
  discountAmount: number;
  finalAmount: number;
  status: string;
  deletedAt: string | null;
  details: {
    id: string;
    invoiceId: string;
    serviceId: string;
    serviceName: string;
    quantity: number;
    price: number;
    note: string | null;
  }[];
  customerName: string | null;
  spaName: string | null;
};

export const serviceApi = createApi({
  reducerPath: "serviceApi",
  baseQuery: axiosBaseQuery({
    baseUrl,
  }),
  endpoints: (build) => ({
    createCategory: build.mutation<CategoryData, CreateCategory>({
      query: (category: CreateCategory) => ({
        url: "/category",
        method: "Post",
        data: category,
      }),
    }),

    getCategories: build.mutation<CategoryData[], void>({
      query: () => ({
        url: "/category",
        method: "Get",
      }),
    }),

    getCategoryById: build.query<CategoryData, string>({
      query: (id) => ({
        url: `/category/${id}`,
        method: "Get",
      }),
    }),

    updateCategory: build.mutation<
      CategoryData,
      { id: string; data: CreateCategory }
    >({
      query: ({ id, data }) => ({
        url: `/category/${id}`,
        method: "Put",
        data,
      }),
    }),

    deleteCategory: build.mutation<void, string>({
      query: (id) => ({
        url: `/category/${id}`,
        method: "Delete",
      }),
    }),

    createService: build.mutation<ServiceData, FormData>({
      query: (formData) => ({
        url: "/services",
        method: "Post",
        body: formData,
        // headers: {
        //   "Content-Type": "multipart/form-data",
        // },
      }),
    }),

    getServices: build.mutation<ServiceData[], { spaId?: string }>({
      query: (data) => ({
        url: "/services",
        method: "Get",
        params: {
          spaId: data.spaId,
        },
      }),
    }),

    getServiceById: build.query<ServiceData, string>({
      query: (id) => ({
        url: `/services/${id}`,
        method: "Get",
      }),
    }),

    updateService: build.mutation<CategoryData, { id: string; data: FormData }>(
      {
        query: ({ id, data }) => ({
          url: `/services/${id}`,
          method: "Put",
          body: data,
        }),
      }
    ),

    deleteService: build.mutation<void, string>({
      query: (id) => ({
        url: `/services/${id}`,
        method: "Delete",
      }),
    }),

    createAppointment: build.mutation<CreateAppointment, CreateAppointment>({
      query: (data) => ({
        url: `/services/appointments`,
        method: "Post",
        data,
      }),
    }),

    getAppointments: build.mutation<
      CreateAppointment[],
      {
        spaId?: string;
        customerId?: string;
      }
    >({
      query: ({ spaId, customerId }) => ({
        url: `/services/appointments`,
        method: "Get",
        params: {
          spaId,
          customerId,
        },
      }),
    }),

    getAppointmentById: build.query<AppointmentData, string>({
      query: (id) => ({
        url: `/services/appointments/${id}`,
        method: "Get",
      }),
    }),

    updateAppointment: build.mutation<
      AppointmentData,
      { id: string; appointment: UpdateAppointment }
    >({
      query: ({ id, appointment }) => ({
        url: `/services/appointments/${id}`,
        method: "Put",
        data: appointment,
      }),
    }),

    updateCompletedAppointment: build.mutation<
      AppointmentData,
      { id: string; appointment: UpdateCompletedAppointment }
    >({
      query: ({ id, appointment }) => ({
        url: `/services/appointments/${id}/complete`,
        method: "Post",
        data: appointment,
      }),
    }),

    deleteAppointment: build.mutation<void, string>({
      query: (id) => ({
        url: `/services/appointments/${id}`,
        method: "Delete",
      }),
    }),

    getAllInvoices: build.mutation<
      InvoiceData[],
      {
        spaId?: string;
        customerId?: string;
      }
    >({
      query: ({ spaId, customerId }) => ({
        url: `/services/invoices`,
        method: "Get",
        params: {
          spaId,
          customerId,
        },
      }),
    }),

    getInvoiceByAppointmentId: build.query<InvoiceData, string>({
      query: (id) => ({
        url: `/services/invoices/${id}`,
        method: "Get",
      }),
    }),

    confirmInvoice: build.mutation<void, string>({
      query: (id) => ({
        url: `/services/invoices/confirm/${id}`,
        method: "Post",
      }),
    }),

    updateInvoiceByAppointmentId: build.mutation<
      InvoiceData,
      { id: string; data: UpdateCompletedAppointment }
    >({
      query: ({ id, data }) => ({
        url: `/services/invoices/${id}/update-complete`,
        method: "Post",
        data,
      }),
    }),
  }),
});

export const {
  useCreateCategoryMutation,
  useGetCategoriesMutation,
  useGetCategoryByIdQuery,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,

  useCreateServiceMutation,
  useGetServicesMutation,
  useGetServiceByIdQuery,
  useUpdateServiceMutation,
  useDeleteServiceMutation,

  useCreateAppointmentMutation,
  useGetAppointmentsMutation,
  useGetAppointmentByIdQuery,
  useUpdateAppointmentMutation,
  useUpdateCompletedAppointmentMutation,
  useDeleteAppointmentMutation,

  useGetAllInvoicesMutation,
  useGetInvoiceByAppointmentIdQuery,
  useConfirmInvoiceMutation,
  useUpdateInvoiceByAppointmentIdMutation,
} = serviceApi;
