# Hylo & 宝塔服务器多应用自动更新部署指南

为了实现桌面端应用全自动打包、发布和自动更新，同时避免在手动更新主网站（如 `ainx.ink`）时误删已发布的客户端安装包，本项目采用 **“多应用统一更新源与物理目录隔离”** 策略。

此方案高度通用，后续有其他新项目（例如 `w-link`）需要自动更新时，可以直接复用本套策略和配置。

---

## 一、 服务器架构设计

### 1. 物理目录结构
在服务器的 `/www/wwwroot/` 网站根目录平级处，创建一个统一的管理目录 `apps`：
```text
/www/wwwroot/
├── ainx.ink/          # 主站目录（您日常覆盖更新该目录，不影响 apps）
└── apps/              # 统一应用更新目录（物理隔离）
    ├── hylo/          # 存放 Hylo 的安装包及 updater.json
    └── w-link/        # 存放 w-link 的安装包及 updater.json（预留）
```

### 2. Nginx 路径映射（宝塔面板配置）
通过 Nginx 的 `alias`（别名）指令，将主域名的 `/apps/` 路径安全地指向外部的物理目录 `/www/wwwroot/apps/`。

**宝塔配置步骤**：
1. 登录宝塔面板，进入 **“网站”** 菜单。
2. 找到 `ainx.ink` 站点，点击 **“设置”**。
3. 选择左侧的 **“配置文件”**。
4. 在 `server` 块内（建议放在现有 location 块附近），粘贴以下代码：
   ```nginx
   # 统一应用更新与下载别名映射
   location /apps/ {
       alias /www/wwwroot/apps/;
       autoindex on;            # 允许列出文件目录（方便用户直接找包）
       client_max_body_size 100m; # 允许大文件上传限制
   }
   ```
5. 点击 **“保存”** 即可生效。

---

## 二、 客户端配置 (`tauri.conf.json`)

在客户端代码中，Tauri 的 updater 插件端点（Endpoints）需要指向此统一地址：
```json
  "plugins": {
    "updater": {
      "active": true,
      "pubkey": "你的加密公钥",
      "endpoints": [
        "https://ainx.ink/apps/hylo/updater.json"
      ]
    }
  }
```

---

## 三、 GitHub CI/CD 全自动部署流

在 `.github/workflows/release.yml` 的多平台编译完成后，会触发一个最终的 `deploy-to-server` 任务。

### 1. 部署逻辑步骤
1. **下载产物**：自动连接到 GitHub Release 获取本次发布（v*）的所有包和 `.sig` 签名文件。
2. **生成 updater.json**：通过脚本提取 `.sig` 签名内容，自动组装生成统一的 `updater.json` 索引文件。
3. **安全上传 (SCP)**：通过密钥将所有平台安装包和 `updater.json` 批量上传到服务器的 `/www/wwwroot/apps/hylo/` 目录下。

### 2. 需要在 GitHub 仓库配置的 Secrets 变量
在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中，添加以下 5 个机密变量：

| 变量名称 | 含义 | 宝塔面板对应参考值 |
| :--- | :--- | :--- |
| `SERVER_HOST` | 服务器 IP 或域名 | `ainx.ink` |
| `SERVER_USER` | SSH 登录用户名 | `root` （或具有 apps 目录读写权限的专用用户） |
| `SERVER_PORT` | SSH 端口 | `22` （若在宝塔安全设置中修改了 SSH 端口，请填修改后的） |
| `SERVER_DEPLOY_PATH` | 本项目对应的服务器部署绝对路径 | `/www/wwwroot/apps/hylo/` |
| `SERVER_SSH_KEY` | **SSH 私钥** | 格式为 `-----BEGIN OPENSSH PRIVATE KEY-----` 开头的密钥内容 |

> [!IMPORTANT]
> **关于 SSH 密钥生成规范：**
> 1. 为了安全性，推荐专门在宝塔终端里为 GitHub 部署生成一对专属密钥：
>    ```bash
>    ssh-keygen -t ed25519 -f ~/.ssh/github_actions_hylo -C "github-actions-deploy"
>    ```
> 2. 将公钥内容追加到服务器的授权列表：
>    ```bash
>    cat ~/.ssh/github_actions_hylo.pub >> ~/.ssh/authorized_keys
>    chmod 600 ~/.ssh/authorized_keys
>    ```
> 3. 将私钥 `~/.ssh/github_actions_hylo` 里的所有文本复制，作为 `SERVER_SSH_KEY` 填入 GitHub Secrets。

---

## 四、 以后新建项目如何复用？

如果以后您新建了一个项目（如 `w-link`）需要自动更新，只需执行以下极简步骤：

1. **服务器创建目录**：在宝塔服务器中创建目录：`/www/wwwroot/apps/w-link/`。（因为 Nginx 已经映射了 `/apps/` 根目录，所以不需要再修改 Nginx 配置）。
2. **客户端配置**：将新项目的 `tauri.conf.json` 中的 endpoints 改为 `"https://ainx.ink/apps/w-link/updater.json"`。
3. **工作流配置**：复制本项目中的 `.github/workflows/release.yml`，只需将对应的 GitHub Secrets 中的 `SERVER_DEPLOY_PATH` 指向该项目对应的路径（`/www/wwwroot/apps/w-link/`）即可。
