"""
缓存服务模块 - 缓存故事和图片，避免重复生成

功能：
1. 基于输入参数生成缓存key
2. 检查缓存是否存在
3. 保存故事和图片到缓存
4. 从缓存加载故事和图片
"""
import os
import json
import hashlib
from typing import Dict, Any, Optional, List
from pathlib import Path


# 缓存目录
CACHE_DIR = Path(__file__).parent / "cache"
STORY_CACHE_DIR = CACHE_DIR / "stories"
IMAGE_CACHE_DIR = CACHE_DIR / "images"

# 确保缓存目录存在
CACHE_DIR.mkdir(exist_ok=True)
STORY_CACHE_DIR.mkdir(exist_ok=True)
IMAGE_CACHE_DIR.mkdir(exist_ok=True)


def generate_cache_key(
    goal: str,
    current_asset: float,
    monthly_income: float,
    selected_path: Dict[str, Any]
) -> str:
    """
    生成缓存key
    
    基于输入参数生成唯一的缓存key
    使用MD5哈希确保key的唯一性和安全性
    """
    # 构建缓存数据（排序以确保一致性）
    cache_data = {
        "goal": goal,
        "currentAsset": round(current_asset, 2),  # 保留2位小数，避免浮点误差
        "monthlyIncome": round(monthly_income, 2),
        "selectedPath": {
            "name": selected_path.get("name", ""),
            "monthlySave": round(selected_path.get("monthlySave", 0), 2),
            "expectedReturn": round(selected_path.get("expectedReturn", 0), 2),
            "targetMonths": selected_path.get("targetMonths", 0),
            "riskLevel": selected_path.get("riskLevel", "")
        }
    }
    
    # 转换为JSON字符串（排序键以确保一致性）
    cache_str = json.dumps(cache_data, sort_keys=True, ensure_ascii=False)
    
    # 生成MD5哈希
    cache_key = hashlib.md5(cache_str.encode('utf-8')).hexdigest()
    
    return cache_key


def get_story_cache_path(cache_key: str) -> Path:
    """获取故事缓存文件路径"""
    return STORY_CACHE_DIR / f"{cache_key}.json"


def get_image_cache_path(cache_key: str, chapter_index: int) -> Path:
    """获取图片缓存文件路径"""
    return IMAGE_CACHE_DIR / f"{cache_key}_chapter_{chapter_index}.json"


def load_story_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    从缓存加载故事
    
    Returns:
        如果缓存存在，返回故事数据；否则返回None
    """
    cache_path = get_story_cache_path(cache_key)
    
    if not cache_path.exists():
        return None
    
    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            print(f"✓ 从缓存加载故事: {cache_key[:8]}...")
            return cache_data
    except Exception as e:
        print(f"加载缓存失败: {e}")
        return None


def save_story_cache(cache_key: str, chapters: List[Dict[str, Any]]) -> bool:
    """
    保存故事到缓存
    
    Args:
        cache_key: 缓存key
        chapters: 章节列表
    
    Returns:
        是否保存成功
    """
    try:
        cache_path = get_story_cache_path(cache_key)
        
        cache_data = {
            "cache_key": cache_key,
            "chapters": chapters,
            "cached_at": str(Path(__file__).stat().st_mtime)  # 使用文件修改时间作为缓存时间
        }
        
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ 故事已缓存: {cache_key[:8]}...")
        return True
    except Exception as e:
        print(f"保存缓存失败: {e}")
        return False


def load_image_cache(cache_key: str, chapter_index: int) -> Optional[str]:
    """
    从缓存加载图片URL
    
    Args:
        cache_key: 缓存key
        chapter_index: 章节索引
    
    Returns:
        如果缓存存在，返回图片URL；否则返回None
    """
    cache_path = get_image_cache_path(cache_key, chapter_index)
    
    if not cache_path.exists():
        return None
    
    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            image_url = cache_data.get("image_url")
            if image_url:
                print(f"✓ 从缓存加载图片: {cache_key[:8]}... chapter {chapter_index}")
                return image_url
            return None
    except Exception as e:
        print(f"加载图片缓存失败: {e}")
        return None


def save_image_cache(cache_key: str, chapter_index: int, image_url: str) -> bool:
    """
    保存图片URL到缓存
    
    Args:
        cache_key: 缓存key
        chapter_index: 章节索引
        image_url: 图片URL
    
    Returns:
        是否保存成功
    """
    try:
        cache_path = get_image_cache_path(cache_key, chapter_index)
        
        cache_data = {
            "cache_key": cache_key,
            "chapter_index": chapter_index,
            "image_url": image_url,
            "cached_at": str(Path(__file__).stat().st_mtime)
        }
        
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ 图片已缓存: {cache_key[:8]}... chapter {chapter_index}")
        return True
    except Exception as e:
        print(f"保存图片缓存失败: {e}")
        return False


def check_story_cache(
    goal: str,
    current_asset: float,
    monthly_income: float,
    selected_path: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    检查故事缓存是否存在
    
    Args:
        goal: 目标
        current_asset: 当前资产
        monthly_income: 月收入
        selected_path: 选择的路径
    
    Returns:
        如果缓存存在，返回故事数据；否则返回None
    """
    cache_key = generate_cache_key(goal, current_asset, monthly_income, selected_path)
    return load_story_cache(cache_key)


def check_image_cache(
    goal: str,
    current_asset: float,
    monthly_income: float,
    selected_path: Dict[str, Any],
    chapter_index: int
) -> Optional[str]:
    """
    检查图片缓存是否存在
    
    Args:
        goal: 目标
        current_asset: 当前资产
        monthly_income: 月收入
        selected_path: 选择的路径
        chapter_index: 章节索引
    
    Returns:
        如果缓存存在，返回图片URL；否则返回None
    """
    cache_key = generate_cache_key(goal, current_asset, monthly_income, selected_path)
    return load_image_cache(cache_key, chapter_index)


def save_story_to_cache(
    goal: str,
    current_asset: float,
    monthly_income: float,
    selected_path: Dict[str, Any],
    chapters: List[Dict[str, Any]]
) -> bool:
    """
    保存故事到缓存
    
    Args:
        goal: 目标
        current_asset: 当前资产
        monthly_income: 月收入
        selected_path: 选择的路径
        chapters: 章节列表
    
    Returns:
        是否保存成功
    """
    cache_key = generate_cache_key(goal, current_asset, monthly_income, selected_path)
    return save_story_cache(cache_key, chapters)


def save_image_to_cache(
    goal: str,
    current_asset: float,
    monthly_income: float,
    selected_path: Dict[str, Any],
    chapter_index: int,
    image_url: str
) -> bool:
    """
    保存图片到缓存
    
    Args:
        goal: 目标
        current_asset: 当前资产
        monthly_income: 月收入
        selected_path: 选择的路径
        chapter_index: 章节索引
        image_url: 图片URL
    
    Returns:
        是否保存成功
    """
    cache_key = generate_cache_key(goal, current_asset, monthly_income, selected_path)
    return save_image_cache(cache_key, chapter_index, image_url)

