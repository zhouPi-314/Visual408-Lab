// POSIX socket 的最小客户端骨架（示意，未在本机构建验证）
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>

int connect_demo(const char* ip, unsigned short port) {
    int fd = ::socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    ::inet_pton(AF_INET, ip, &addr.sin_addr);

    // connect() 内部完成三次握手：SYN → SYN,ACK → ACK
    if (::connect(fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
        ::close(fd);
        return -1;
    }
    // close() 触发四次挥手
    ::close(fd);
    return 0;
}
