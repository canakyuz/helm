import type { RefineThemedLayoutHeaderProps } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { BgColorsOutlined, CheckOutlined } from "@ant-design/icons";
import {
  Layout as AntdLayout,
  Avatar,
  Button,
  Dropdown,
  Space,
  Typography,
  theme,
} from "antd";
import type React from "react";
import { useHelmTheme } from "../../theme/ThemeProvider";

const { useToken } = theme;

type IUser = {
  id: string;
  name: string;
  avatar?: string;
};

// Üst bar — tema seçici + kullanıcı. Navigasyon kenar çubuğunda.
export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
  sticky = true,
}) => {
  const { token } = useToken();
  const { data: user } = useGetIdentity<IUser>();
  const { themeKey, setThemeKey, themes } = useHelmTheme();

  const headerStyles: React.CSSProperties = {
    backgroundColor: token.colorBgContainer,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    padding: "0 24px",
    height: 64,
  };

  if (sticky) {
    headerStyles.position = "sticky";
    headerStyles.top = 0;
    headerStyles.zIndex = 10;
  }

  return (
    <AntdLayout.Header style={headerStyles}>
      <Dropdown
        trigger={["click"]}
        menu={{
          selectable: true,
          selectedKeys: [themeKey],
          onClick: ({ key }) => setThemeKey(key),
          items: themes.map((t) => ({
            key: t.key,
            label: t.label,
            icon:
              t.key === themeKey ? (
                <CheckOutlined />
              ) : (
                <span style={{ display: "inline-block", width: 14 }} />
              ),
          })),
        }}
      >
        <Button type="text" icon={<BgColorsOutlined />}>
          Tema
        </Button>
      </Dropdown>

      <Space size="small">
        {user?.name && (
          <Typography.Text type="secondary">{user.name}</Typography.Text>
        )}
        <Avatar
          size="small"
          src={user?.avatar}
          style={{ backgroundColor: token.colorPrimary }}
        >
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </Avatar>
      </Space>
    </AntdLayout.Header>
  );
};
